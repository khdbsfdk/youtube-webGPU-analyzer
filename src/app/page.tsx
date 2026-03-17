'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Play, Pause, Camera, Loader2, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=1La4QzGeaaQ');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<{ time: number; text: string; image: string }[]>([]);
  const [workerReady, setWorkerReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e) => {
      const { status, output, type } = e.data;
      if (status === 'ready') {
        setWorkerReady(true);
      } else if (status === 'update' && type === 'generation') {
        // partial generation output handling if needed
      } else if (status === 'complete') {
        setAnalysisHistory(prev => [...prev, {
          time: videoRef.current?.currentTime || 0,
          text: output,
          image: prev[prev.length - 1]?.image || '' // The actual image is appended earlier
        }]);
        setIsLoading(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setVideoSrc(`/api/video?url=${encodeURIComponent(url)}`);
    setIsPlaying(false);
  };

  const handleCaptureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !workerReady) return;

    // Pause video
    videoRef.current.pause();
    setIsPlaying(false);
    setIsLoading(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas dimensions to match video logic
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data URL for preview
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Add temporary entry
    setAnalysisHistory(prev => [...prev, {
      time: video.currentTime,
      text: 'Analyzing...',
      image: dataUrl
    }]);

    // Send to worker
    workerRef.current?.postMessage({
      type: 'analyze',
      image: dataUrl
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12 font-sans font-medium">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-indigo-400 to-purple-400 bg-clip-text text-transparent inline-flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" /> WebGPU Video AI
            </h1>
            <p className="text-slate-400 mt-1">Real-time YouTube frame analysis via Transformers.js v3</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 border ${workerReady ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' : 'bg-amber-950/40 text-amber-400 border-amber-900/50'}`}>
               {workerReady ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span> : <Loader2 className="w-3 h-3 animate-spin"/>}
               {workerReady ? 'AI Engine Ready' : 'Loading Moondream2 WebGPU...'}
             </div>
          </div>
        </header>

        <form onSubmit={handleLoadVideo} className="flex gap-2 w-full">
          <Input 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-slate-900 border-slate-800 focus-visible:ring-indigo-500"
          />
          <Button type="submit" variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Search className="w-4 h-4 mr-2" /> Load Video
          </Button>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Video Player (CORS Proxy)</CardTitle>
              <CardDescription className="text-slate-400">Video streamed through edge API to bypass canvas taint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 group shadow-2xl shadow-indigo-900/20">
                {videoSrc ? (
                  <video 
                    ref={videoRef}
                    crossOrigin="anonymous"
                    src={videoSrc}
                    className="w-full h-full object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    controls
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    Enter a YouTube URL to start
                  </div>
                )}
                
                {/* Floating Analyze Button overlay */}
                {videoSrc && (
                   <div className="absolute bottom-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button 
                       onClick={handleCaptureAndAnalyze}
                       disabled={!workerReady || isLoading}
                       className="bg-purple-600 hover:bg-purple-500 text-white shadow-xl px-6 rounded-full"
                     >
                       {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                       Analyze Frame
                     </Button>
                   </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle>AI Analysis Stream</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-[400px] lg:h-full p-4">
                <div className="space-y-4">
                  {analysisHistory.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">No frames analyzed yet.</div>
                  ) : (
                    analysisHistory.map((item, i) => (
                      <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-16 h-12 flex-shrink-0 rounded bg-slate-800 overflow-hidden border border-slate-700">
                          {item.image && <img src={item.image} alt="Frame" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1">
                           <div className="text-xs text-indigo-400 font-mono mb-1">
                             {Math.floor(item.time / 60)}:{(item.time % 60).toFixed(0).padStart(2, '0')}
                           </div>
                           <div className={`p-3 rounded-lg bg-slate-800/80 border border-slate-700/50 ${item.text === 'Analyzing...' ? 'text-slate-400 animate-pulse' : 'text-slate-200'} leading-relaxed`}>
                             {item.text}
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
