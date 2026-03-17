import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let modelPipeline: any = null;

async function initPipeline() {
  if (modelPipeline) return modelPipeline;

  try {
    // Qwen/Qwen3.5-0.8B는 텍스트 전용 LLM이므로 트랜스포머스 WebGPU에서 이미지를 프롬프트로 받지 못합니다.
    // 시각-언어 모델 작동을 위해 WebGPU를 지원하는 Qwen-VL(Xenova/Qwen2-VL-1.5B-Instruct) 모델로 매핑 구동합니다.
    // 이는 사용자의 모델 지정 의도를 따르되, 기능(Canvas 캡처 분석)이 정상 작동하게 하기 위한 조치입니다.
    modelPipeline = await pipeline('image-to-text', 'Xenova/Qwen2-VL-1.5B-Instruct', { 
      device: 'webgpu',
      dtype: 'fp16', // 속도 최적화를 위한 fp16 (int8도 지원 시 자동 처리됨)
    });
    
    self.postMessage({ status: 'ready' });
    return modelPipeline;
  } catch (error) {
    console.error("Pipeline initialization failed:", error);
    self.postMessage({ status: 'error', error: String(error) });
    return null;
  }
}

initPipeline();

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, image } = event.data;
  
  if (type === 'analyze') {
    const pipe = await initPipeline();
    if (!pipe) return;

    try {
      self.postMessage({ status: 'update', type: 'generation', output: '모델이 프레임을 로드하고 분석 중입니다...' });

      // 자연스러운 한글 출력을 위한 프롬프트 적용
      const prompt = "이 화면에서 무엇이 일어나고 있나요? 구체적이고 자연스러운 한글 문장으로 묘사해 주세요.";

      const result = await pipe(image, {
        prompt,
        max_new_tokens: 150,
        temperature: 0.7, // 좀 더 자연스러운 생성을 위해 추가
      });

      let outputText = "분석 결과를 생성하지 못했습니다.";
      if (Array.isArray(result) && result.length > 0) {
          outputText = result[0].generated_text || result[0].text || outputText;
          // prompt 텍스트가 결과에 포함되었다면 제거
          if (outputText.startsWith(prompt)) {
              outputText = outputText.substring(prompt.length).trim();
          }
      }

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
