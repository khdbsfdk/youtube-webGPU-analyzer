# YouTube WebGPU Analyzer

이 프로젝트는 YouTube URL을 입력받아 브라우저 내에서 직접 구동되는 VLM(Vision Language Model, `moondream2`)을 사용하여 실시간으로 특정 영상 화면을 캡처하고 분석(해설)하는 Next.js 애플리케이션입니다.

## 주요 기능

- **Next.js 다운스트리밍 API**: 브라우저의 `<canvas>` CORS 제약을 우회하기 위해 백엔드 트랜스코딩 없이 영상을 원활하게 프록시 캐싱하여 프론트엔드로 전달합니다.
- **WebGPU AI 엔진**: `@huggingface/transformers` v3를 활용하여 외부 서버 접속 없이 클라이언트 기기의 GPU(WebGPU) 자원만으로 서버리스 AI 추론을 진행합니다.
- **모던 UI**: Tailwind CSS와 Shadcn UI를 이용한 깔끔하고 반응형인 대시보드 화면.

## 실행 환경 구성 가이드

### 1단계: 크롬 WebGPU 활성화 (필수)
현재 WebGPU는 Chrome 및 Edge의 최신 버전에서 기본으로 지원되거나 플래그를 통해 활성화해야 합니다.
1. Chrome 브라우저 주소창에 `chrome://flags/#enable-unsafe-webgpu` 를 입력하고 이동합니다.
2. **Unsafe WebGPU** 플래그를 검색하여 `Enabled` 로 변경합니다.
3. 브라우저를 다시 시작(Relaunch)합니다.

### 2단계: 프로젝트 클론 및 패키지 설치
1. 저장소를 로컬 컴퓨터로 클론합니다.
   ```bash
   git clone https://github.com/khdbsfdk/youtube-webGPU-analyzer.git
   cd youtube-webGPU-analyzer
   ```
2. npm을 통해 의존성 패키지를 설치합니다.
   ```bash
   npm install
   ```

### 3단계: 로컬 서버 실행
1. 개발 서버를 시작합니다.
   ```bash
   npm run dev
   ```
2. 브라우저에서 [http://localhost:3000](http://localhost:3000) 로 접속합니다.

## 배포 가이드 (Vercel)
이 프로젝트는 Vercel 배포에 최적화되어 있습니다.
1. Vercel(https://vercel.com/) 에 로그인합니다.
2. "Add New Project" 에서 사용자의 GitHub 계정과 연동한 뒤, `youtube-webGPU-analyzer` 저장소를 선택해 'Import'를 누릅니다.
3. 별도의 설정 없이 "Deploy" 버튼을 클릭하여 배포를 진행합니다. (루트 디렉토리 및 빌드 명령어는 Next.js 프리셋으로 자동 적용됩니다.)

## 주의 사항
- YouTube 동영상 스트리밍을 프록시하는 동안 연령 제한이 있거나 실시간 라이브 영상인 경우 `ytdl-core` 정책에 의해 다운스트림이 제한될 수 있습니다.
