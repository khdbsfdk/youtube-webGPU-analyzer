# YouTube WebGPU Analyzer (Production Grade Qwen Edition)

이 프로젝트는 YouTube URL을 입력받아 브라우저 내에서 직접 구동되는 VLM(Vision Language Model) 매핑을 통해 실시간 화면을 캡처하고 **자연스러운 한글 문장**으로 분석해 주는 Next.js 애플리케이션입니다.

이번 프로덕션 등급(Production-Grade) 릴리스에서는 **Qwen3.5-0.8B (Qwen-VL-1.5B)** 기반의 고성능 시각-언어 모델 환경과 세련된 **2컬럼 다크 모드(Glassmorphism)** 레이아웃을 제공합니다.

## ✨ 주요 기능 및 특징

- **Qwen 기반 WebGPU AI 엔진**: `@huggingface/transformers` v3를 활용하여 외부 서버나 API 호출 없이 클라이언트 기기의 WebGPU(`dtype: fp16`) 자원만을 사용해 초고속 인퍼런스(추론)를 진행합니다.
- **혁신적인 2-Column 대시보드 UI**: Shadcn/UI 컴포넌트를 이용해 디자인되었으며, 좌측(60%) 비디오 플레이어와 우측(40%) 터미널형 AI 채팅 로그를 동시에 깔끔하게 확인할 수 있습니다.
- **Next.js 다운스트리밍 프록시 API**: `<canvas>`의 엄격한 CORS 제약을 우회하기 위해 `ytdl-core`를 활용한 커스텀 스트림 버퍼링 프록시(`/api/video`)가 구현되어 있습니다.

## 🚀 실행 환경 구성 가이드 (중요)

### 1단계: 크롬 WebGPU 지원 활성화
Qwen 모델의 fp16 연산을 원활하게 구동하기 위해 브라우저의 WebGPU 기능을 명시적으로 켜야 할 수 있습니다. (Edge, Chrome 공통)
1. 주소창에 `chrome://flags/#enable-unsafe-webgpu` 를 입력하고 접속합니다.
2. **Unsafe WebGPU** 플래그를 검색하여 상태를 `Enabled` 로 변경합니다.
3. 브라우저 창 하단의 **Relaunch(다시 시작)** 버튼을 클릭합니다.

### 2단계: 클론 및 패키지 설치
1. GitHub에서 프로젝트를 클론합니다.
   ```bash
   git clone https://github.com/khdbsfdk/youtube-webGPU-analyzer.git
   cd youtube-webGPU-analyzer
   ```
2. npm을 사용해 종속성 모듈을 설치합니다.
   ```bash
   npm install
   ```

### 3단계: 로컬 서버 실행 및 분석
1. 로컬 개발 서버를 실행 구동합니다.
   ```bash
   npm run dev
   ```
2. 브라우저에서 [http://localhost:3000](http://localhost:3000) 에 접속합니다.
3. 최초 접속 시 Qwen 모델(약 1GB 이상)이 캐싱 다운로드 완료될 때까지 "Waiting for WebGPU Ready" 상태를 기다립니다.
4. 비디오URL을 입력하고 '분석하기'를 눌러 화면 해설을 테스트합니다!

## 🌍 Vercel 배포 가이드
본 프로젝트 폴더 내에는 빌드 명령어와 엔진 명세가 포함된 `vercel.json`가 내장되어 있어 Vercel 플랫폼에서 곧바로 원클릭 배포(Import)가 가능합니다. 

*주의: 프록시 서버 연산이 필요하므로 Vercel Edge Runtime 혹은 안정적인 Region을 지정하는 것을 권장합니다.*
