/* ==========================================================================
   llm-brain.js — the twin's optional full brain: a small LLM in the browser.
   SmolLM2-360M-Instruct (q4, ~300 MB) via vendored transformers.js.
   RAG-grounded: the corpus matcher retrieves facts, the model only phrases.
   Implements the TwinBrain contract { ready, kind, answer(q) } and NEVER
   throws — every failure resolves back to the caller's fallback.
   To swap models later (e.g. a self-fine-tuned one on HF): change MODEL_ID.
   ========================================================================== */
const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';

export function createLLMBrain({corpus, fallback, onProgress, onStatus}){
  let generator=null;

  function retrieve(q,k){
    q=q.toLowerCase();
    return corpus
      .map(item=>{ let s=0; for(const p of item.p) if(q.includes(p)) s+=p.length; return {s,a:item.a}; })
      .sort((a,b)=>b.s-a.s)
      .slice(0,k)
      .filter(x=>x.s>0)
      .map(x=>x.a);
  }

  const brain={
    ready:false,
    kind:'smollm2-360m',
    async load(){
      try{
        onStatus && onStatus('waking the neurons…');
        const T=await import('../lib/transformers.min.js');
        T.env.allowLocalModels=false;
        const device=(navigator.gpu)?'webgpu':'wasm';
        onStatus && onStatus('downloading weights ('+device+')…');
        generator=await T.pipeline('text-generation', MODEL_ID, {
          dtype:'q4',
          device,
          progress_callback:(p)=>{
            if(p.status==='progress' && p.total && onProgress)
              onProgress(Math.round(p.loaded/p.total*100), p.file||'');
          }
        });
        brain.ready=true;
        onStatus && onStatus('ready');
        return true;
      }catch(err){
        onStatus && onStatus('failed: '+(err && err.message ? err.message.slice(0,80) : 'unknown'));
        generator=null;
        brain.ready=false;
        return false;
      }
    },
    async answer(q){
      if(!generator) return fallback.answer(q);
      try{
        const facts=retrieve(q,3);
        const context=facts.length?facts.join('\n'):'(no matching fact — say you only know his portfolio topics)';
        const messages=[
          {role:'system', content:
            "You are Saptarshi Nag's digital twin — a calm, warm fairy companion in his portfolio game. "+
            "Answer the visitor's question in first person about Saptarshi ('he'), in 1-3 short sentences, "+
            "using ONLY the facts below. If the facts don't cover it, say so gently and suggest what you do know.\n\nFACTS:\n"+context},
          {role:'user', content:q}
        ];
        const out=await generator(messages,{max_new_tokens:130, do_sample:false, return_full_text:false});
        const txt=(out && out[0] && (out[0].generated_text?.at?.(-1)?.content ?? out[0].generated_text)) || '';
        const clean=(typeof txt==='string'?txt:'').trim();
        return clean.length>3 ? clean : fallback.answer(q);
      }catch(e){
        return fallback.answer(q);   /* any generation hiccup → the local mind covers */
      }
    }
  };
  return brain;
}
