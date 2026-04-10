'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Camera, Play, Sparkles, CheckCircle2, Youtube, Brain, Settings2, ImageIcon, Zap, ChevronRight, X } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getThumbUrl(videoId: string, quality: 'maxresdefault' | 'hqdefault' | 'sddefault' = 'hqdefault') {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

// ─── Log Types ───────────────────────────────────────────────────────────────
type LogEntry = { id: number; text: string; type: 'system' | 'ai' | 'error' | 'info' };

let logId = 0;

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=1La4QzGeaaQ');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);

  const [prompt, setPrompt] = useState('이 유튜브 동영상의 썸네일을 분석해서 한국어로 설명해 주세요. 화면에 보이는 모든 요소, 텍스트, 사람, 물체, 배경, 분위기 등을 상세하게 묘사해 주세요.');
  const [maxTokens, setMaxTokens] = useState(512);
  const [temperature, setTemperature] = useState(0.1);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: logId++, text: 'SmolVLM WebGPU 모델 초기화 대기 중...', type: 'system' }
  ]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'system') => {
    setLogs(prev => [...prev, { id: logId++, text, type }]);
  }, []);

  // ── Worker Init ────────────────────────────────────────────────────────────
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const data = e.data;
      if (data.status === 'ready') {
        setWorkerReady(true);
        addLog('SmolVLM 256M 모델이 WebGPU에 로드되었습니다. 준비 완료!', 'info');
      } else if (data.status === 'loading') {
        addLog(data.message || '모델 로딩 중...', 'system');
      } else if (data.status === 'progress') {
        // Only log once on first progress tick
        setLogs(prev => {
          const hasProgress = prev.some(l => l.text.includes('다운로드'));
          if (hasProgress) return prev;
          return [...prev, { id: logId++, text: '모델 파일 다운로드 중... (~512MB, 처음 한 번만)', type: 'system' }];
        });
      } else if (data.status === 'complete') {
        setIsLoading(false);
        setResultText(data.output);
        addLog(`✓ 분석 완료 (${data.time}초 소요)`, 'info');
      } else if (data.status === 'error') {
        setIsLoading(false);
        addLog(data.error, 'error');
        setResultText(`오류: ${data.error}`);
      } else if (data.status === 'update') {
        // Stream tokens in real-time to the result box
        setResultText(data.output);
        if (data.output && !data.output.includes('중...')) {
          // Don't spam logs with each token; just update result
        } else {
          addLog(data.output, 'system');
        }
      }
    };

    return () => workerRef.current?.terminate();
  }, [addLog]);

  // ── Auto-scroll logs ───────────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Load video ─────────────────────────────────────────────────────────────
  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(url.trim());
    if (!id) {
      addLog('유효하지 않은 YouTube URL입니다.', 'error');
      return;
    }
    setVideoId(id);
    setResultText('');
    setCapturedImage(null);
    addLog(`영상 로드: https://www.youtube.com/watch?v=${id}`, 'system');
  };

  // ── Analyze thumbnail ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!videoId || !workerReady) return;

    setIsLoading(true);
    setResultText('');
    addLog('YouTube 썸네일을 캡처하여 AI 분석을 시작합니다...', 'system');

    // Try maxres first, fall back to hq
    let thumbUrl = getThumbUrl(videoId, 'maxresdefault');
    
    try {
      const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(thumbUrl)}`);
      if (!res.ok) {
        thumbUrl = getThumbUrl(videoId, 'hqdefault');
        const res2 = await fetch(`/api/thumbnail?url=${encodeURIComponent(thumbUrl)}`);
        if (!res2.ok) throw new Error('썸네일 불러오기 실패');
        const blob2 = await res2.blob();
        const dataUrl = await blobToDataUrl(blob2);
        setCapturedImage(dataUrl);
        sendToWorker(dataUrl);
      } else {
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        setCapturedImage(dataUrl);
        sendToWorker(dataUrl);
      }
    } catch (err: any) {
      addLog(`썸네일 오류: ${err.message}`, 'error');
      setIsLoading(false);
    }
  };

  const sendToWorker = (dataUrl: string) => {
    workerRef.current?.postMessage({
      type: 'analyze',
      image: dataUrl,
      prompt,
      maxTokens,
      temperature,
    });
  };

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  // ─────────────────── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}>
      
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center shadow-sm">
              <Youtube className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm leading-none">YouTube</span>
              <span className="font-semibold text-indigo-600 text-sm leading-none ml-1">AI Analyzer</span>
            </div>
          </div>

          {/* URL Bar */}
          <form onSubmit={handleLoadVideo} className="flex-1 max-w-2xl flex items-center gap-2">
            <div className="relative flex-1">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="YouTube URL을 붙여넣으세요..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              로드
            </button>
          </form>

          {/* Model Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
            workerReady 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {workerReady ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> AI 준비완료</>
            ) : (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 모델 로딩</>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Video Player (3/5) ──────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* Video Embed */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  영상 플레이어
                </h2>
                {videoId && (
                  <a 
                    href={`https://www.youtube.com/watch?v=${videoId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                  >
                    원본 보기 <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
              
              <div className="aspect-video bg-gray-950 relative">
                {videoId ? (
                  <iframe
                    key={videoId}
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                    title="YouTube Video Player"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                      <Play className="w-8 h-8 text-gray-400 ml-1" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-400">위에 YouTube URL을 입력하고</p>
                      <p className="text-sm text-gray-500">로드 버튼을 누르세요.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analyze Button + Logs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={!workerReady || isLoading || !videoId}
                  className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-white transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: (!workerReady || isLoading || !videoId) 
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                  }}
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> AI 분석 중...</>
                  ) : (
                    <><Camera className="w-5 h-5" /> 썸네일 AI 분석</>
                  )}
                </button>
                <button
                  onClick={() => setShowSettings(s => !s)}
                  className={`p-3 rounded-xl border transition-all ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  <Settings2 className="w-5 h-5" />
                </button>
              </div>

              {/* Settings Drawer */}
              {showSettings && (
                <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">분석 프롬프트</label>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      rows={3}
                      className="w-full text-xs p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Max Tokens</label>
                      <input
                        type="number"
                        value={maxTokens}
                        onChange={e => setMaxTokens(Number(e.target.value))}
                        className="w-24 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Temperature</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={temperature}
                        onChange={e => setTemperature(Number(e.target.value))}
                        className="w-24 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Log Terminal */}
              <div className="bg-gray-950 h-36 overflow-y-auto p-3 font-mono" id="log-container">
                <div className="space-y-0.5">
                  {logs.map((log) => (
                    <div key={log.id} className={`text-xs leading-relaxed flex gap-2 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'ai' ? 'text-purple-300' :
                      log.type === 'info' ? 'text-emerald-400' :
                      'text-gray-400'
                    }`}>
                      <span className="shrink-0 opacity-50">
                        {log.type === 'error' ? '✗' : log.type === 'ai' ? '◆' : log.type === 'info' ? '✓' : '›'}
                      </span>
                      <span>{log.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Analysis Panel (2/5) ─────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Thumbnail Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">분석 이미지</h2>
              </div>
              <div className="p-4">
                {capturedImage ? (
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                    <img 
                      src={capturedImage} 
                      alt="분석된 썸네일" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
                      썸네일
                    </div>
                  </div>
                ) : videoId ? (
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                    {/* Show YouTube thumbnail preview */}
                    <img 
                      src={getThumbUrl(videoId, 'hqdefault')}
                      alt="YouTube 썸네일 미리보기"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl text-xs font-medium text-gray-700 shadow-sm text-center">
                        <Brain className="w-4 h-4 mx-auto mb-1 text-indigo-500" />
                        '썸네일 AI 분석' 버튼을<br />눌러 분석을 시작하세요
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <p className="text-xs">영상 로드 후 표시됩니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Output */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold text-gray-700">AI 분석 결과</h2>
                </div>
                {resultText && (
                  <button 
                    onClick={() => { setResultText(''); setCapturedImage(null); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="p-4 min-h-[280px] max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">AI가 이미지를 분석 중입니다</p>
                      <p className="text-xs text-gray-400 mt-1">WebGPU로 로컬에서 처리 중...</p>
                    </div>
                  </div>
                ) : resultText ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{resultText}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <Brain className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">분석 결과가 여기에 표시됩니다</p>
                      <p className="text-xs text-gray-400 mt-1">영상 로드 후 '썸네일 AI 분석'을 누르세요</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Model Info Card */}
            <div className={`rounded-2xl border p-4 transition-all ${workerReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${workerReady ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {workerReady ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />}
                </div>
                <div>
                  <p className={`text-xs font-bold ${workerReady ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {workerReady ? 'SmolVLM 256M Ready' : '모델 다운로드 중...'}
                  </p>
                  <p className={`text-xs mt-0.5 ${workerReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {workerReady 
                      ? 'WebGPU 로컬 추론 · 데이터 미전송 · 무료' 
                      : '약 512MB · 최초 1회만 다운로드됩니다'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
