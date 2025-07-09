import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { categoryId } = await request.json()
    const params = await context.params
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update the document's category
    const { data, error } = await supabase
      .from('documents')
      .update({ 
        category_id: categoryId,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.documentId)
      .select()

    if (error) {
      console.error('Error updating document category:', error)
      return NextResponse.json({ error: 'Failed to update document category' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      document: data[0],
      message: 'Document moved successfully'
    })

  } catch (error) {
    console.error('Error in move-to-category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
