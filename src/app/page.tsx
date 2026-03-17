'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Camera, Loader2, Sparkles, TerminalSquare, AlertCircle, PlayCircle } from 'lucide-react';

interface LogMessage {
  id: string;
  role: 'system' | 'user' | 'ai';
  text: string;
  image?: string;
}

export default function Dashboard() {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=1La4QzGeaaQ');
  const [videoSrc, setVideoSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([
    { id: '1', role: 'system', text: 'System initialized. Loading Qwen3.5-0.8B (WebGPU FP16) Vision module...' }
  ]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = (role: 'system' | 'user' | 'ai', text: string, image?: string) => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), role, text, image }]);
  };

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e) => {
      const { status, output, error } = e.data;
      if (status === 'ready') {
        setWorkerReady(true);
        addLog('system', 'Qwen3.5-0.8B Vision Module loaded successfully. Ready for inference.');
      } else if (status === 'complete') {
        setIsLoading(false);
        addLog('ai', output);
      } else if (status === 'error') {
        setIsLoading(false);
        addLog('system', `Error: ${error}`);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLoading]);

  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setVideoSrc(`/api/video?url=${encodeURIComponent(url)}`);
    addLog('system', `Proxy stream requested for URL: ${url}`);
  };

  const handleCaptureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !workerReady) return;

    videoRef.current.pause();
    setIsLoading(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    addLog('user', '해당 프레임의 시각적 분석을 요청했습니다.', dataUrl);

    workerRef.current?.postMessage({
      type: 'analyze',
      image: dataUrl
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-zinc-800">
      {/* Header - Glassmorphism */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="container flex h-16 max-w-7xl mx-auto items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">YouTube WebGPU Analyzer</h1>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs font-medium text-zinc-400 border border-zinc-700 ml-2 hidden sm:inline-block">
              Qwen3.5-0.8B
            </span>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${workerReady ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
               {workerReady ? (
                 <>
                   <span className="relative flex h-2 w-2">
                     <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                   </span>
                   WebGPU Connected
                 </>
               ) : (
                 <>
                   <Loader2 className="h-3 w-3 animate-spin" />
                   Initializing Model...
                 </>
               )}
             </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl p-6 h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
          
          {/* Left Column (60%): Video Section */}
          <div className="lg:col-span-3 flex flex-col gap-4 h-full">
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-md shadow-xl flex-col flex overflow-hidden rounded-2xl h-[calc(100vh-8rem)] border-t-zinc-700/50">
              
              {/* URL Input Area */}
              <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/80">
                <form onSubmit={handleLoadVideo} className="flex gap-3 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="YouTube 동영상 URL 입력..."
                      className="pl-10 bg-zinc-950/50 border-zinc-800 focus-visible:ring-indigo-500/50 h-11 text-sm shadow-inner transition-all hover:bg-zinc-950"
                    />
                  </div>
                  <Button type="submit" className="bg-zinc-100 hover:bg-white text-zinc-900 h-11 px-6 shadow-lg shadow-white/5 font-semibold transition-transform active:scale-95">
                    <PlayCircle className="w-4 h-4 mr-2" /> 
                    비디오 로드
                  </Button>
                </form>
              </div>

              {/* Video Player */}
              <div className="flex-1 relative flex flex-col bg-black">
                {videoSrc ? (
                  <video 
                    ref={videoRef}
                    crossOrigin="anonymous"
                    src={videoSrc}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4 bg-gradient-to-b from-zinc-900/20 to-zinc-950">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center border border-zinc-800/80 shadow-inner">
                      <AlertCircle className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-sm">비디오를 불러와 분석을 시작하세요.</p>
                  </div>
                )}
              </div>
              
              {/* Action Area */}
              <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/80 flex justify-between items-center">
                <div className="text-xs text-zinc-500 font-medium">
                  {videoSrc ? '프록시 스트림 우회 활성화' : '대기 중...'}
                </div>
                <Button 
                  onClick={handleCaptureAndAnalyze}
                  disabled={!workerReady || isLoading || !videoSrc}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/20 transition-all h-10 px-6 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  <span className="font-semibold">{isLoading ? '분석 중...' : '프레임 분석하기'}</span>
                </Button>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </Card>
          </div>

          {/* Right Column (40%): AI Insight Log */}
          <Card className="lg:col-span-2 border-zinc-800 bg-zinc-900/30 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden rounded-2xl border-t-zinc-700/50 h-[calc(100vh-8rem)]">
            <CardHeader className="py-4 border-b border-zinc-800/80 bg-zinc-900/60 sticky top-0 z-10 flex flex-row items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-5 h-5 text-indigo-400" />
                <CardTitle className="text-base font-semibold tracking-wide text-zinc-100">
                  AI 분석 로그
                </CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <ScrollArea className="h-full p-4 lg:p-6" style={{ height: "calc(100vh - 12.5rem)" }}>
                <div className="space-y-6 pb-4">
                  {logs.map((log) => (
                    <div key={log.id} className={`flex flex-col gap-2 ${log.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-0.5 px-1 tracking-wide">
                        {log.role === 'system' && <span className="text-emerald-500">SYSTEM</span>}
                        {log.role === 'user' && <span>USER / CAPTURE</span>}
                        {log.role === 'ai' && <span className="text-indigo-400 flex items-center gap-1"><Sparkles className="w-3 h-3"/> QWEN AI</span>}
                      </div>

                      <div className={`
                        max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                        ${log.role === 'system' ? 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 font-mono text-xs' : ''}
                        ${log.role === 'user' ? 'bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-tr-sm' : ''}
                        ${log.role === 'ai' ? 'bg-indigo-500/10 text-zinc-200 border border-indigo-500/20 rounded-tl-sm' : ''}
                      `}>
                        {log.image && (
                          <div className="mb-3 rounded-lg overflow-hidden border border-zinc-700/50 relative group">
                            <img src={log.image} alt="Captured frame target" className="w-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                        )}
                        {log.text}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex flex-col gap-2 items-start animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-0.5 px-1 tracking-wide">
                        <Sparkles className="w-3 h-3 animate-pulse" /> QWEN AI 분석 중...
                      </div>
                      <div className="max-w-[85%] w-64 rounded-2xl rounded-tl-sm bg-indigo-500/5 border border-indigo-500/10 p-4 space-y-3 shadow-inner">
                        <Skeleton className="h-4 w-full bg-indigo-500/20 rounded" />
                        <Skeleton className="h-4 w-[80%] bg-indigo-500/20 rounded" />
                        <Skeleton className="h-4 w-[60%] bg-indigo-500/20 rounded" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
        </div>
      </main>
    </div>
  );
}
