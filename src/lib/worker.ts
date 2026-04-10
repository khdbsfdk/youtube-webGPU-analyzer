import {
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  load_image,
} from '@huggingface/transformers';

const MODEL_ID = 'HuggingFaceTB/SmolVLM-256M-Instruct';
const MAX_NEW_TOKENS = 512;

// Singleton pattern for lazy loading
class SmolVLM {
  static processor: any = null;
  static model: any = null;

  static async getInstance(progress_callback?: (x: any) => void) {
    if (!this.processor) {
      this.processor = AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback,
      });
    }
    if (!this.model) {
      this.model = AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
        dtype: 'fp32',  // Use fp32 for broader WebGPU compatibility
        device: 'webgpu',
        progress_callback,
      });
    }
    return Promise.all([this.processor, this.model]);
  }
}

// ─── Load model on startup ────────────────────────────────────────────────────
async function loadModel() {
  self.postMessage({ status: 'loading', message: '모델 로딩 중...' });

  try {
    await SmolVLM.getInstance((progress: any) => {
      if (progress.status === 'progress' || progress.status === 'downloading') {
        self.postMessage({
          status: 'progress',
          file: progress.file,
          progress: progress.progress,
        });
      }
    });

    self.postMessage({ status: 'ready' });
  } catch (err: any) {
    console.error('Model load error:', err);
    self.postMessage({ status: 'error', error: String(err) });
  }
}

// Start loading immediately
loadModel();

// ─── Generate response ────────────────────────────────────────────────────────
async function generate(imageDataUrl: string, promptText: string, maxTokens: number, temperature: number) {
  try {
    const [processor, model] = await SmolVLM.getInstance();

    self.postMessage({ status: 'update', output: '이미지 로딩 중...' });

    // Load image from data URL
    const image = await load_image(imageDataUrl);

    // Build messages
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image' },
          { type: 'text', text: promptText || '이 이미지를 자세히 분석해서 한국어로 설명해 주세요.' },
        ],
      },
    ];

    // Apply chat template
    const text = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
    });

    // Preprocess inputs
    const inputs = await processor(text, [image]);

    self.postMessage({ status: 'update', output: 'WebGPU에서 AI 추론 중...' });

    const startTime = performance.now();

    // Collect streamed tokens
    let outputText = '';
    const callback_function = (output: string) => {
      outputText += output;
      self.postMessage({ status: 'update', output: outputText });
    };

    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
    });

    const { sequences } = await model.generate({
      ...inputs,
      do_sample: false,
      repetition_penalty: 1.1,
      max_new_tokens: maxTokens || MAX_NEW_TOKENS,
      streamer,
      return_dict_in_generate: true,
    });

    const decoded = processor.batch_decode(sequences, { skip_special_tokens: true });
    const endTime = performance.now();
    const timeSec = ((endTime - startTime) / 1000).toFixed(1);

    // The decoded output includes the prompt; extract only the assistant reply
    const fullText = decoded[0] || outputText;
    const assistantMarker = 'Assistant:';
    const assistantIdx = fullText.lastIndexOf(assistantMarker);
    const finalOutput = assistantIdx !== -1
      ? fullText.substring(assistantIdx + assistantMarker.length).trim()
      : (outputText || fullText).trim();

    self.postMessage({
      status: 'complete',
      output: finalOutput,
      time: timeSec,
    });
  } catch (e: any) {
    console.error('Generation error:', e);
    self.postMessage({ status: 'error', error: e.message || String(e) });
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, image, prompt, maxTokens, temperature } = event.data;

  if (type === 'analyze') {
    generate(image, prompt, maxTokens, temperature);
  }
});
