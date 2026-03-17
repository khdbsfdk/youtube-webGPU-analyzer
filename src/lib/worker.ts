import { pipeline, env } from '@huggingface/transformers';

// Skip local model check since we're using a web worker to fetch directly from HF Hub
env.allowLocalModels = false;

// Pre-load the moondream2 model using WebGPU
let modelPipeline: any = null;

async function initPipeline() {
  if (modelPipeline) return modelPipeline;

  try {
    modelPipeline = await pipeline('image-to-text', 'Xenova/moondream2', { 
      device: 'webgpu',
      dtype: 'fp16', // often required or preferred on webgpu
    });
    
    // Notify the main thread that the model is ready
    self.postMessage({ status: 'ready' });
    return modelPipeline;
  } catch (error) {
    console.error("Pipeline initialization failed:", error);
    self.postMessage({ status: 'error', error: String(error) });
    return null;
  }
}

// Start lazy loading in background
initPipeline();

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, image } = event.data;
  
  if (type === 'analyze') {
    const pipe = await initPipeline();
    if (!pipe) return;

    try {
      self.postMessage({ status: 'update', type: 'generation', output: 'Starting inference...' });

      // Run inference
      const result = await pipe(image, {
        max_new_tokens: 150,
      });

      const outputText = Array.isArray(result) && result.length > 0 && result[0].generated_text
        ? result[0].generated_text
        : "Failed to generate description";

      self.postMessage({ 
        status: 'complete', 
        output: outputText 
      });

    } catch (e: any) {
      console.error(e);
      self.postMessage({ status: 'error', error: e.message });
    }
  }
});
