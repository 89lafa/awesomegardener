import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { content_type, content_id, content_data } = await req.json();
    
    if (!content_type || !content_id || !content_data) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    let prompt = '';
    let checkType = '';
    
    if (content_type === 'image') {
      checkType = 'image';
      prompt = `You are a content moderator. Review this image and determine if it contains any inappropriate content including:
- Pornography or sexually explicit content
- Graphic violence, gore, or murder
- Hate symbols or extremist content
- Illegal activities

Respond with a safety assessment.`;
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [content_data.image_url],
        response_json_schema: {
          type: "object",
          properties: {
            is_safe: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            issues_found: { type: "array", items: { type: "string" } },
            explanation: { type: "string" }
          }
        }
      });
      
      // Update the submission with AI review
      await base44.asServiceRole.entities.VarietyImageSubmission.update(content_id, {
        ai_review_status: response.is_safe ? 'pass' : 'fail',
        ai_review_confidence: response.confidence,
        ai_review_notes: response.explanation,
        ai_reviewed_at: new Date().toISOString()
      });
      
      return Response.json({
        success: true,
        result: response
      });
      
    } else if (content_type === 'variety_review') {
      checkType = 'text';
      prompt = `You are a content moderator. Review this variety review and determine if it contains any inappropriate content including:
- Profanity, vulgar language, or offensive terms
- Harassment, hate speech, or discriminatory language
- Spam or irrelevant content
- Personal attacks

Review content:
Title: ${content_data.title || 'N/A'}
Description: ${content_data.description || 'N/A'}
Variety Name: ${content_data.variety_name || 'N/A'}

Respond with a safety assessment.`;
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            is_safe: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            issues_found: { type: "array", items: { type: "string" } },
            explanation: { type: "string" }
          }
        }
      });
      
      // Update the review with AI check
      await base44.asServiceRole.entities.VarietyReview.update(content_id, {
        ai_review_status: response.is_safe ? 'pass' : 'fail',
        ai_review_confidence: response.confidence,
        ai_review_notes: response.explanation,
        ai_reviewed_at: new Date().toISOString()
      });
      
      return Response.json({
        success: true,
        result: response
      });
    }
    
    return Response.json({ error: 'Invalid content type' }, { status: 400 });
    
  } catch (error) {
    console.error('[AI Review] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});