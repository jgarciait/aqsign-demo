import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { BUCKET_PUBLIC } from '@/utils/supabase/storage'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('mappingId')
    const documentId = searchParams.get('documentId')
    const availableOnly = searchParams.get('availableOnly') === 'true'
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Authenticated user:', user.id, user.email)

    if (mappingId) {
      // Get document ID from mapping ID (keep user-specific for this case)
      const { data: mapping, error: mappingError } = await supabase
        .from('document_signature_mappings')
        .select('document_id')
        .eq('id', mappingId)
        .eq('created_by', user.id)
        .single()

      if (mappingError || !mapping) {
        return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
      }

      return NextResponse.json({ documentId: mapping.document_id })
    }

    if (documentId) {
      // Get specific document by ID (GLOBAL ACCESS: any authenticated user can access any document)
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          file_path,
          created_at,
          status,
          created_by
        `)
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Get creator information separately
      const { data: creator } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', document.created_by)
        .single()

      const publicUrl = supabase.storage
        .from('public-documents')
        .getPublicUrl(document.file_path).data.publicUrl
      
      const documentWithUrl = {
        id: document.id,
        file_name: document.file_name,
        file_url: publicUrl,
        created_at: document.created_at,
        status: document.status || 'draft',
        created_by: document.created_by,
        creator: {
          full_name: creator?.full_name || 'Usuario',
          email: creator?.email || ''
        }
      }

      return NextResponse.json({ documents: [documentWithUrl] })
    }

    // GLOBAL ACCESS: Get all documents for all users (not just current user)
    let documentsQuery = supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_path,
        created_at,
        status,
        created_by,
        document_type
      `)
      .eq('archived', false)

    // If availableOnly is true, exclude documents that have mappings or signing requests
    if (availableOnly) {
      // For sent-to-sign: Show documents that DON'T have templates associated (globally accessible)
      // A document is "available" if it doesn't have signature mapping templates
      // Also exclude fast_sign documents as they should not appear in sent-to-sign
      documentsQuery = documentsQuery.or('document_type.is.null,document_type.eq.email')
      
      // Get all signature mapping templates to find which documents are used as templates
      const { data: allTemplates, error: templatesError } = await supabase
        .from('signature_mapping_templates')
        .select('document_mapping_id')
        .eq('is_active', true)

      if (templatesError) {
        console.error('Error fetching templates for availableOnly filter:', templatesError)
      }

      // Get the document mappings that are used by templates
      const templateMappingIds = (allTemplates || []).map(t => t.document_mapping_id).filter(Boolean)
      
      if (templateMappingIds.length > 0) {
        const { data: templateMappings, error: mappingsError } = await supabase
          .from('document_signature_mappings')
          .select('document_id')
          .in('id', templateMappingIds)

        if (mappingsError) {
          console.error('Error fetching template mappings:', mappingsError)
        }

        // Exclude documents that are used in templates
        const excludeIds = (templateMappings || []).map(m => m.document_id).filter(Boolean)

        console.log('Excluding templated document IDs:', excludeIds)

        if (excludeIds.length > 0) {
          documentsQuery = documentsQuery.not('id', 'in', `(${excludeIds.join(',')})`)
        }
      } else {
        console.log('No templates found, showing all documents as available')
      }
    }

    // Add search filter if provided
    if (search) {
      documentsQuery = documentsQuery.ilike('file_name', `%${search}%`)
    }

    // Add limit if provided
    if (limit) {
      documentsQuery = documentsQuery.limit(parseInt(limit))
    }

    // Get documents
    const { data: documents, error } = await documentsQuery.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    console.log(`Found ${documents?.length || 0} documents`)
    if (availableOnly) {
      console.log('Available only filter applied - documents with types:', documents?.map(d => ({ id: d.id, name: d.file_name, type: d.document_type })))
    }

    // Get all unique creator IDs
    const creatorIds = [...new Set(documents?.map(doc => doc.created_by).filter(Boolean))]
    
    // Get creator information for all documents
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', creatorIds)

    // Create a map of creator information
    const creatorsMap = new Map(creators?.map(creator => [creator.id, creator]) || [])

    // Transform documents and generate public URLs
    const documentsWithUrls = (documents || []).map(doc => {
      console.log(`Document file_path: ${doc.file_path}`)
      
      const publicUrl = supabase.storage
        .from('public-documents')
        .getPublicUrl(doc.file_path).data.publicUrl
      
      console.log(`Generated URL: ${publicUrl}`)
      
      const creator = creatorsMap.get(doc.created_by)
      
      return {
        id: doc.id,
        file_name: doc.file_name,
        file_url: publicUrl,
        created_at: doc.created_at,
        status: doc.status || 'draft',
        created_by: doc.created_by,
        creator: {
          full_name: creator?.full_name || 'Usuario',
          email: creator?.email || ''
        }
      }
    })

    return NextResponse.json({ documents: documentsWithUrls })
  } catch (error) {
    console.error('Error in GET /api/documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Deleting document:', documentId, 'for user:', user.id)

    // Check if document exists (global access - any user can delete any document)
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_path, created_by')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete related records first (in correct order due to foreign key constraints)
    
    // 1. Delete signing requests
    const { error: signingRequestsError } = await supabase
      .from('signing_requests')
      .delete()
      .eq('document_id', documentId)

    if (signingRequestsError) {
      console.error('Error deleting signing requests:', signingRequestsError)
      // Continue with deletion process
    }

    // 2. Delete document signature mappings
    const { error: mappingsError } = await supabase
      .from('document_signature_mappings')
      .delete()
      .eq('document_id', documentId)

    if (mappingsError) {
      console.error('Error deleting document signature mappings:', mappingsError)
      // Continue with deletion process
    }

    // 3. Delete document annotations
    const { error: annotationsError } = await supabase
      .from('document_annotations')
      .delete()
      .eq('document_id', documentId)

    if (annotationsError) {
      console.error('Error deleting document annotations:', annotationsError)
      // Continue with deletion process
    }

    // 4. Delete any signatures related to this document (if they exist in a signatures table)
    const { error: signaturesError } = await supabase
      .from('signatures')
      .delete()
      .eq('document_id', documentId)

    if (signaturesError) {
      console.error('Error deleting signatures:', signaturesError)
      // Continue with deletion process - this table might not exist
    }

    // 5. Delete the file from storage
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('public-documents')
        .remove([document.file_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with deletion process - storage error shouldn't block database cleanup
      }
    }

    // 6. Finally, delete the document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      console.error('Error deleting document from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    console.log('Document deleted successfully:', documentId)
    return NextResponse.json({ success: true, message: 'Documento eliminado exitosamente' })

  } catch (error) {
    console.error('Error in DELETE /api/documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
