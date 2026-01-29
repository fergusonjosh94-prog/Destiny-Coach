
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, FunctionDeclaration, Type, LiveServerMessage } from '@google/genai';
import { Layout } from './components/Layout';
import { Message, ConnectionStatus, StrategyGuide, User, EncounterState, PriorityTarget } from './types';
import { createBlob, decode, decodeAudioData } from './services/audioUtils';

const FRAME_RATE = 1; 
const JPEG_QUALITY = 0.5;

interface VoiceConfig {
  name: string;
  geminiVoice: string;
  persona: string;
  instruction: string;
}

const VOICE_CORES: Record<string, VoiceConfig> = {
  ghost: {
    name: "Tactical Ghost",
    geminiVoice: "Zephyr",
    persona: "Helpful, robotic, and quick-witted.",
    instruction: "You are a robotic tactical assistant. Keep responses brief and immersion-focused like a Destiny Ghost."
  },
  commander: {
    name: "Vanguard Commander",
    geminiVoice: "Fenrir",
    persona: "Authoritative, steady, and strategic.",
    instruction: "Speak with authority and gravitas. You are a Commander overseeing a high-stakes operation."
  },
  scholar: {
    name: "Ancient Scholar",
    geminiVoice: "Puck",
    persona: "Wise, curious, and slightly aloof.",
    instruction: "Use sophisticated language. You are an ancient scholar of the Light, providing wisdom on mechanics."
  },
  stranger: {
    name: "Exo Stranger",
    geminiVoice: "Kore",
    persona: "Stoic, mysterious, and direct.",
    instruction: "Be direct and blunt. You have seen many timelines; tell the Guardian exactly what they need to do to survive."
  },
  drifter: {
    name: "Rogue Lightbearer",
    geminiVoice: "Charon",
    persona: "Charismatic, street-smart, and energetic.",
    instruction: "Be energetic and slightly informal. Use slang like 'Brother' or 'Sister'. You love a good scrap."
  }
};

const ACTIVITIES: Record<string, StrategyGuide[]> = {
  "Raids": [
    {
      activityName: "VOW OF THE DISCIPLE",
      maxCapacity: 6,
      roles: [{ title: "Runners", loadout: "Symbols / Mobility" }, { title: "Stunners", loadout: "Linear Fusion / Divinity" }],
      mechanics: ["Collect 3 symbols in dark room", "Stun Caretaker back/head", "Match symbols on totems"],
      pitfalls: ["Darkness stacks at x10 kills", "Failing stun window"],
      lowManData: { 
        feasibility: 'EXTREME', 
        difficultyRating: 9.5, 
        duoStrategy: "Extremely tight timing on symbol collection and stun cycling.", 
        bypassMechanics: ["Solo-symbol skip"],
        detailedBypassInstructions: ["Use a high-mobility setup to clip through the symbols room barrier during transition frames."],
        recommendedSkills: ["Symbol Memorization", "Frame-perfect Stuns", "Agility Cycling"]
      }
    },
    {
      activityName: "SALVATION'S EDGE",
      maxCapacity: 6,
      roles: [{ title: "Verity Team", loadout: "Fast clear / Wave Frame" }, { title: "Conductor", loadout: "Survivability / Still Hunt" }],
      mechanics: ["Bounce resonance between hands", "Match shapes in Verity", "Witness DPS plate rotation"],
      pitfalls: ["Shape mis-match", "Witness beam tracking"],
      lowManData: { 
        feasibility: 'IMPOSSIBLE', 
        difficultyRating: 10, 
        duoStrategy: "Currently theoretically impossible due to Verity shape mechanics.", 
        bypassMechanics: [],
        detailedBypassInstructions: [],
        recommendedSkills: ["Spatial Reasoning", "High APM", "Resonance Management"]
      }
    },
    {
      activityName: "ROOT OF NIGHTMARES",
      maxCapacity: 6,
      roles: [{ title: "Runners", loadout: "Eager Edge / Icarus" }, { title: "Add Clear", loadout: "Sunshot / Incandescent" }],
      mechanics: ["Connect Light/Dark seeds", "Shelter from Nezarec wipe", "Simultaneous seed completion"],
      pitfalls: ["Seed bounce interference", "Nezarec aggro management"],
      lowManData: { 
        feasibility: 'FEASIBLE', 
        difficultyRating: 7, 
        duoStrategy: "One runner for each side. Requires high mobility.", 
        bypassMechanics: ["Seed skipping"],
        detailedBypassInstructions: ["Jump over the barrier using Eager Edge to bypass the seed tracking logic for second floor."],
        recommendedSkills: ["Eager Edge Mastery", "Aggro Manipulation", "Sync Comms"]
      }
    }
  ],
  "Dungeons": [
    {
      activityName: "VESPER'S HOST",
      maxCapacity: 3,
      roles: [{ title: "Operator", loadout: "Precision / Scout" }, { title: "Scanner", loadout: "Mobility / Grapple" }],
      mechanics: ["Hack terminals in sequence", "Avoid radiation stacks", "Vesper core manipulation"],
      pitfalls: ["Radiation x10", "Misaligned terminal hacks"],
      lowManData: { 
        feasibility: 'FEASIBLE', 
        difficultyRating: 8, 
        duoStrategy: "Solo-operation is possible with fast movement.", 
        bypassMechanics: [],
        detailedBypassInstructions: [],
        recommendedSkills: ["Efficient Pathing", "Timer Management", "Solo Operator Logic"]
      }
    },
    {
      activityName: "WARLORD'S RUIN",
      maxCapacity: 3,
      roles: [{ title: "DPS", loadout: "Dragon's Breath / Mountaintop" }, { title: "Totem Team", loadout: "Add clear / Indebted Kindness" }],
      mechanics: ["Stand in corruption circles", "Transfer hex to melee target", "Climb the peak during DPS"],
      pitfalls: ["Hex expiration death", "Totem capture failure"],
      lowManData: { 
        feasibility: 'FEASIBLE', 
        difficultyRating: 6, 
        duoStrategy: "Very comfortable duo. Focus on hex timing.", 
        bypassMechanics: ["Hex transfer glitch"],
        detailedBypassInstructions: ["Melee the target and swap weapons simultaneously to prevent the hex from returning to you."],
        recommendedSkills: ["Melee Tracking", "Hex Timing", "Environment Awareness"]
      }
    }
  ],
  "Grandmasters": [
    {
      activityName: "THE CORRUPTED",
      maxCapacity: 3,
      roles: [{ title: "Orb Thrower", loadout: "Stun / Barrier" }, { title: "DPS", loadout: "Precision / Overload" }],
      mechanics: ["Charge orbs for shield break", "Inter-dimensional travel", "Boss knockback avoidance"],
      pitfalls: ["Shuro Chi knockback", "Overload champion regen"],
      lowManData: { 
        feasibility: 'EXTREME', 
        difficultyRating: 9, 
        duoStrategy: "Requires perfect orb passing and aggro swapping.", 
        bypassMechanics: [],
        detailedBypassInstructions: [],
        recommendedSkills: ["Precision Throwing", "Champion Stun Cycling", "Cover Utilization"]
      }
    }
  ]
};

const updateEncounterStatusTool: FunctionDeclaration = {
  name: "updateEncounterStatus",
  description: "Updates the tactical HUD with encounter phase, tips, and highlights priority targets seen in the feed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      phase: { type: Type.STRING, description: "Current phase of the fight." },
      tip: { type: Type.STRING, description: "Actionable advice." },
      dangerLevel: { type: Type.STRING, enum: ["SAFE", "CAUTION", "CRITICAL"] },
      targets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["CHAMPION", "ELITE", "BOSS", "HIVE_GHOST"] },
            subType: { type: Type.STRING, enum: ["OVERLOAD", "BARRIER", "UNSTOPPABLE"] },
            name: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["ACTIVE", "STUNNED", "VULNERABLE"] },
            position: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER, description: "X position normalized 0-100" },
                y: { type: Type.NUMBER, description: "Y position normalized 0-100" },
                w: { type: Type.NUMBER, description: "Width normalized 0-100" },
                h: { type: Type.NUMBER, description: "Height normalized 0-100" }
              }
            }
          }
        }
      }
    },
    required: ["phase", "tip", "dangerLevel"]
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showPlatformSelect, setShowPlatformSelect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDossier, setShowDossier] = useState(true);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<string>("ghost");
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fireteamSize, setFireteamSize] = useState<number>(2);
  const [isMuted, setIsMuted] = useState(true); 
  const [isGhostSpeaking, setIsGhostSpeaking] = useState(false);
  const [inputMode, setInputMode] = useState<'camera' | 'stream' | 'twitch'>('camera');
  const [twitchChannel, setTwitchChannel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>("Raids");
  const [maxDiffFilter, setMaxDiffFilter] = useState<number>(10);
  const [hideImpossible, setHideImpossible] = useState<boolean>(false);
  
  const [activeStrategy, setActiveStrategy] = useState<StrategyGuide>(ACTIVITIES["Raids"][0]);
  const [encounterState, setEncounterState] = useState<EncounterState>({
    phase: 'AWAITING UPLINK...',
    activeTip: 'Select activity and link feed.',
    dangerLevel: 'SAFE',
    lastUpdated: Date.now(),
    targets: []
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const isMutedRef = useRef(true);
  const isGhostSpeakingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key.toLowerCase() === 'v') && status === ConnectionStatus.CONNECTED) {
        setIsMuted(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') {
        setIsMuted(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isGhostSpeakingRef.current = isGhostSpeaking;
  }, [isGhostSpeaking]);

  const filteredActivities = useMemo(() => {
    let list = ACTIVITIES[selectedCategory] || [];
    return list
      .filter(act => {
        const diff = act.lowManData?.difficultyRating || 0;
        const feasibility = act.lowManData?.feasibility;
        if (diff > maxDiffFilter) return false;
        if (hideImpossible && feasibility === 'IMPOSSIBLE') return false;
        return true;
      })
      .sort((a, b) => (a.lowManData?.difficultyRating || 0) - (b.lowManData?.difficultyRating || 0));
  }, [selectedCategory, maxDiffFilter, hideImpossible]);

  const topTargets = useMemo(() => {
    if (!encounterState.targets) return [];
    const threatOrder = { 'BOSS': 4, 'CHAMPION': 3, 'ELITE': 2, 'HIVE_GHOST': 1 };
    return [...encounterState.targets]
      .sort((a, b) => (threatOrder[b.type] || 0) - (threatOrder[a.type] || 0))
      .slice(0, 3);
  }, [encounterState.targets]);

  const isLowMan = fireteamSize < activeStrategy.maxCapacity;

  const handleStartAuth = () => setShowPlatformSelect(true);

  const handlePlatformLogin = (platform: string) => {
    setUser({
      displayName: `Guardian_${platform.split(' ')[0]}#${Math.floor(Math.random() * 9000) + 1000}`,
      membershipId: Math.random().toString().slice(2, 12),
      membershipType: 3,
      emblemPath: "https://www.bungie.net/common/destiny2_content/icons/38146747d8481f9172f310f8a846f40b.jpg"
    });
    setShowPlatformSelect(false);
  };

  const handleStartSession = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      let stream: MediaStream;
      if (inputMode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }

      if (videoRef.current) videoRef.current.srcObject = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const voiceCore = VOICE_CORES[selectedVoiceKey];

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const sourceInfo = inputMode === 'twitch' ? `Twitch (${twitchChannel})` : 'Tactical Feed';
            setMessages([{ 
                role: 'ghost', 
                text: `${sourceInfo} Uplink established. ${voiceCore.name} Core initialized. Hold 'V' for PTT Uplink.`, 
                timestamp: Date.now() 
            }]);
            
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!isMutedRef.current && !isGhostSpeakingRef.current) {
                const inputData = e.inputBuffer.getChannelData(0);
                sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = videoRef.current.videoWidth;
                  canvasRef.current.height = videoRef.current.videoHeight;
                  ctx.drawImage(videoRef.current, 0, 0);
                  canvasRef.current.toBlob(async (blob) => {
                    if (blob) {
                      const reader = new FileReader();
                      reader.readAsDataURL(blob);
                      reader.onloadend = () => {
                        const base64Data = (reader.result as string).split(',')[1];
                        sessionPromise.then(session => session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
                      };
                    }
                  }, 'image/jpeg', JPEG_QUALITY);
                }
              }
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
               currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
               currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
               const input = currentInputTranscription.current;
               const output = currentOutputTranscription.current;
               if (input) setMessages(prev => [...prev, { role: 'user', text: input, timestamp: Date.now() }]);
               if (output) setMessages(prev => [...prev, { role: 'ghost', text: output, timestamp: Date.now() }]);
               currentInputTranscription.current = '';
               currentOutputTranscription.current = '';
               setTimeout(() => setIsGhostSpeaking(false), 500);
            }

            if (message.toolCall) {
              message.toolCall.functionCalls.forEach(fc => {
                if (fc.name === 'updateEncounterStatus') {
                  setEncounterState({ ...(fc.args as any), lastUpdated: Date.now() });
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: 'HUD Sync' } } }));
                }
              });
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioCtxRef.current) {
              setIsGhostSpeaking(true);
              const ctx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                   setIsGhostSpeaking(false);
                }
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsGhostSpeaking(false);
            }
          },
          onerror: () => setStatus(ConnectionStatus.ERROR),
          onclose: () => setStatus(ConnectionStatus.IDLE)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [updateEncounterStatusTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceCore.geminiVoice as any } }
          },
          systemInstruction: `You are a Destiny 2 Guardian Intelligence persona based on the ${voiceCore.name} Core.
            ${voiceCore.instruction}
            Persona Context: ${voiceCore.persona}
            Monitoring Mode: ${inputMode === 'twitch' ? 'TWITCH STREAM FOR ' + twitchChannel : 'LOCAL GAMEPLAY'}.
            Activity: ${activeStrategy.activityName}. 
            Fireteam: ${fireteamSize}/${activeStrategy.maxCapacity}.
            Floor Management Policy: Only speak when the Guardian addresses you or there is a critical encounter change.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const handleStopSession = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setStatus(ConnectionStatus.IDLE);
  };

  const getDifficultyColor = (rating: number) => {
    if (rating >= 9) return 'text-red-500';
    if (rating >= 7) return 'text-amber-500';
    return 'text-green-500';
  };

  const getFeasibilityBadge = (feasibility: string) => {
    switch (feasibility) {
      case 'FEASIBLE': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'EXTREME': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'IMPOSSIBLE': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <Layout>
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
          <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative shadow-2xl border border-blue-500/30">
            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-6 border-b border-white/10 pb-4">Uplink Configuration</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-3">Guardian Voice Core</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(VOICE_CORES).map(([key, config]) => (
                    <button 
                      key={key} 
                      onClick={() => setSelectedVoiceKey(key)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${selectedVoiceKey === key ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                      <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-wider">{config.name}</p>
                        <p className="text-[9px] opacity-60 italic">{config.persona}</p>
                      </div>
                      {selectedVoiceKey === key && <i className="fas fa-check-circle"></i>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-8 py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg hover:bg-slate-200 transition-all shadow-xl">Apply Settings</button>
          </div>
        </div>
      )}

      {!user ? (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-2xl mx-auto px-4">
          <div className="w-24 h-24 mb-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-400/30 ghost-glow animate-pulse">
             <i className="fas fa-ghost text-4xl text-blue-400"></i>
          </div>
          <h2 className="text-4xl font-black text-white mb-6 tracking-tighter uppercase">GhostAI Tactical Link</h2>
          {!showPlatformSelect ? (
            <button onClick={handleStartAuth} className="bg-white text-black px-12 py-5 rounded-md font-bold hover:bg-slate-100 transition-all shadow-2xl active:scale-95 uppercase tracking-widest">Sign in with Bungie.net</button>
          ) : (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-4">
              {['Steam', 'Xbox', 'PlayStation', 'Epic', 'Twitch'].map(p => (
                <button key={p} onClick={() => handlePlatformLogin(p)} className="flex flex-col items-center p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-blue-600 transition-all">
                  <i className={`fab fa-${p.toLowerCase() === 'epic' ? 'gamepad' : p.toLowerCase()} text-3xl mb-3`}></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-h-[calc(100vh-140px)]">
          {/* Sidebar Left: Activity & Sorting */}
          <div className="lg:col-span-3 flex flex-col space-y-4 overflow-hidden">
            <div className="glass-panel rounded-xl p-5 border border-white/10 flex flex-col flex-1 overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 flex items-center">
                  <i className="fas fa-sliders mr-2"></i> Tactical Filter
                </h3>
                <button onClick={() => setShowSettings(true)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                  <i className="fas fa-cog"></i>
                </button>
              </div>
              <div className="space-y-4 mb-4">
                <div>
                  <div className="flex justify-between text-[8px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                    <span>Low-Man Difficulty Threshold</span>
                    <span className={getDifficultyColor(maxDiffFilter)}>{maxDiffFilter}/10</span>
                  </div>
                  <input type="range" min="1" max="10" step="0.5" value={maxDiffFilter} onChange={(e) => setMaxDiffFilter(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
                <button onClick={() => setHideImpossible(!hideImpossible)} className={`w-full py-2 border rounded text-[8px] font-black tracking-widest uppercase transition-all ${hideImpossible ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                  {hideImpossible ? 'Hiding Impossible' : 'Show Impossible'}
                </button>
              </div>
              <div className="flex p-1 bg-black/40 rounded-lg mb-4">
                {Object.keys(ACTIVITIES).map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{cat}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredActivities.map(act => (
                  <button key={act.activityName} onClick={() => setActiveStrategy(act)} className={`w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden group ${activeStrategy.activityName === act.activityName ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-[10px] font-black tracking-tight uppercase ${activeStrategy.activityName === act.activityName ? 'text-blue-400' : 'text-white'}`}>{act.activityName}</p>
                      <span className={`text-[9px] font-mono font-black ${getDifficultyColor(act.lowManData?.difficultyRating || 0)}`}>{act.lowManData?.difficultyRating}</span>
                    </div>
                    <div className="flex items-center justify-between text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      <span>{act.maxCapacity} MAN MAX</span>
                      <span className={act.lowManData?.feasibility === 'IMPOSSIBLE' ? 'text-red-900' : 'text-blue-500/40'}>{act.lowManData?.feasibility}</span>
                    </div>
                    {activeStrategy.activityName === act.activityName && <div className="absolute left-0 top-0 w-1 h-full bg-blue-500"></div>}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-panel rounded-xl p-5 border border-white/10 shadow-lg h-1/3">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 flex items-center">
                 <i className="fas fa-bullseye mr-2"></i> Threat Detection
               </h3>
               <div className="space-y-2 h-full overflow-y-auto custom-scrollbar">
                {encounterState.targets && encounterState.targets.length > 0 ? encounterState.targets.map(target => (
                  <div key={target.id} className="p-2 bg-red-900/10 border border-red-500/20 rounded text-[10px]">
                    <div className="flex justify-between font-black uppercase tracking-tighter mb-1">
                      <span className="text-red-500">{target.subType || target.type}</span>
                      <span className={target.status === 'STUNNED' ? 'text-green-500' : 'text-amber-500'}>{target.status}</span>
                    </div>
                    <p className="text-white truncate font-bold uppercase opacity-80">{target.name}</p>
                  </div>
                )) : (
                  <div className="text-center py-4 opacity-20"><p className="text-[9px] uppercase font-black tracking-[0.2em]">All Systems Nominal</p></div>
                )}
               </div>
            </div>
          </div>

          {/* Center: Tactical HUD */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            <div className={`relative rounded-xl overflow-hidden glass-panel flex-1 bg-black shadow-2xl border transition-all duration-300 group ${!isMuted ? 'border-blue-500 ring-4 ring-blue-500/30' : 'border-white/10'}`}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              
              {status === ConnectionStatus.CONNECTED && encounterState.targets?.map(target => (
                <div key={target.id} className="absolute border-2 pointer-events-none transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  style={{ left: `${target.position.x}%`, top: `${target.position.y}%`, width: `${target.position.w}%`, height: `${target.position.h}%`, borderColor: target.status === 'STUNNED' ? '#22c55e' : '#ef4444' }}>
                  <div className="absolute top-0 left-0 -translate-y-full bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter whitespace-nowrap">{target.subType || target.type}: {target.name}</div>
                </div>
              ))}

              {/* Dossier Side Panel */}
              <div className={`absolute top-0 right-0 h-full z-40 transition-transform duration-500 ease-in-out ${showDossier ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full w-64 glass-panel border-l border-white/10 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                  <div className="p-4 bg-blue-900/20 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Tactical Dossier</span>
                    <button onClick={() => setShowDossier(false)} className="text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Loadouts */}
                    <section>
                      <h4 className="text-[8px] font-black uppercase text-blue-400 mb-2 flex items-center"><i className="fas fa-gun mr-2"></i> Loadout Recommendations</h4>
                      <div className="space-y-3">
                        {activeStrategy.roles.map((role, idx) => (
                          <div key={idx} className="bg-white/5 border border-white/5 p-2 rounded">
                            <p className="text-[9px] font-black text-white uppercase">{role.title}</p>
                            <p className="text-[8px] text-slate-400 font-mono mt-1">{role.loadout}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                    {/* Mechanics */}
                    <section>
                      <h4 className="text-[8px] font-black uppercase text-blue-400 mb-2 flex items-center"><i className="fas fa-cogs mr-2"></i> Core Mechanics</h4>
                      <ul className="space-y-2">
                        {activeStrategy.mechanics.map((m, idx) => (
                          <li key={idx} className="flex items-start text-[9px] text-slate-300">
                            <span className="text-blue-500 mr-2">•</span>
                            <span className="leading-tight uppercase">{m}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    {/* Feasibility & Skills */}
                    {activeStrategy.lowManData && (
                      <>
                        <section className="pt-4 border-t border-white/5">
                          <h4 className="text-[8px] font-black uppercase text-amber-400 mb-2 flex items-center"><i className="fas fa-chart-line mr-2"></i> Feasibility Analysis</h4>
                          <div className={`p-3 rounded border text-center mb-4 ${getFeasibilityBadge(activeStrategy.lowManData.feasibility)}`}>
                            <p className="text-[10px] font-black tracking-widest">{activeStrategy.lowManData.feasibility}</p>
                            <p className="text-[8px] font-mono mt-1 opacity-70">RATING: {activeStrategy.lowManData.difficultyRating}/10</p>
                          </div>
                          
                          {activeStrategy.lowManData.recommendedSkills && (
                            <div className="space-y-1">
                              <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Required Skills</p>
                              <div className="flex flex-wrap gap-1">
                                {activeStrategy.lowManData.recommendedSkills.map((skill, sidx) => (
                                  <span key={sidx} className="text-[7px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-white/5 uppercase">{skill}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </section>

                        {activeStrategy.lowManData.detailedBypassInstructions && activeStrategy.lowManData.detailedBypassInstructions.length > 0 && (
                          <section className="pt-4 border-t border-white/5">
                            <h4 className="text-[8px] font-black uppercase text-purple-400 mb-2 flex items-center"><i className="fas fa-bolt mr-2"></i> Bypass Intel</h4>
                            <ul className="space-y-2">
                              {activeStrategy.lowManData.detailedBypassInstructions.map((instr, iidx) => (
                                <li key={iidx} className="text-[8px] text-slate-400 italic leading-snug">
                                  "{instr}"
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!showDossier && status === ConnectionStatus.CONNECTED && (
                <button 
                  onClick={() => setShowDossier(true)}
                  className="absolute top-1/2 right-0 -translate-y-1/2 bg-blue-600/80 hover:bg-blue-600 text-white p-2 rounded-l border border-blue-400/30 z-30 transition-all shadow-xl"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
              )}

              {status === ConnectionStatus.IDLE && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md z-10 p-8 text-center">
                  <div className="w-16 h-16 mb-6 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-400/30">
                    <i className="fas fa-satellite-dish text-2xl text-blue-400 animate-pulse"></i>
                  </div>
                  <h3 className="text-xl font-black text-white mb-1 tracking-tighter uppercase italic">{activeStrategy.activityName}</h3>
                  <p className="text-[10px] text-slate-500 mb-8 uppercase tracking-[0.3em] font-black">Ready for Tactical Uplink</p>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-6">
                    <button onClick={() => setInputMode('camera')} className={`p-4 rounded-xl border text-[8px] font-black uppercase transition-all ${inputMode === 'camera' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}><i className="fas fa-camera mb-1 block text-lg"></i> Camera</button>
                    <button onClick={() => setInputMode('stream')} className={`p-4 rounded-xl border text-[8px] font-black uppercase transition-all ${inputMode === 'stream' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}><i className="fas fa-desktop mb-1 block text-lg"></i> Screen</button>
                    <button onClick={() => setInputMode('twitch')} className={`p-4 rounded-xl border text-[8px] font-black uppercase transition-all ${inputMode === 'twitch' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-purple-500/10'}`}><i className="fab fa-twitch mb-1 block text-lg"></i> Twitch</button>
                  </div>
                  <div className="flex items-center space-x-4 w-full max-md">
                    <select value={fireteamSize} onChange={(e) => setFireteamSize(Number(e.target.value))} className="bg-slate-800 border border-white/10 rounded px-4 py-3 text-[10px] font-black text-blue-400 uppercase outline-none focus:ring-1 ring-blue-500">
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Fireteam</option>)}
                    </select>
                    <button onClick={handleStartSession} className="flex-1 py-3 bg-white text-black font-black text-xs uppercase rounded hover:bg-slate-200 transition-all tracking-widest shadow-2xl disabled:opacity-30">Initialize</button>
                  </div>
                </div>
              )}

              {status === ConnectionStatus.CONNECTED && (
                 <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="px-4 py-2 rounded-lg bg-slate-900/80 border-l-4 border-blue-500 backdrop-blur shadow-2xl">
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Link Secure // Tracking Active</p>
                        <p className="text-sm font-black text-white uppercase tracking-tighter">{encounterState.phase}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <div className={`px-5 py-3 rounded-lg backdrop-blur border shadow-2xl transition-all duration-300 scale-100 ${isMuted ? 'bg-amber-900/40 border-amber-500/20 text-amber-500' : 'bg-blue-600 border-blue-400 text-white scale-110 shadow-[0_0_30px_rgba(59,130,246,0.5)]'}`}>
                          <p className="text-[9px] font-black uppercase tracking-widest flex items-center">
                             <i className={`fas ${isMuted ? 'fa-eye' : 'fa-microphone-lines animate-pulse'} mr-2`}></i>
                             {isMuted ? 'Passive Observe' : 'UPLINK LIVE'}
                          </p>
                        </div>
                        {isGhostSpeaking && (
                          <div className="px-3 py-1 bg-blue-500 rounded flex items-center space-x-2 animate-bounce shadow-lg">
                            <i className="fas fa-volume-high text-[8px] text-white"></i>
                            <span className="text-[8px] font-black text-white uppercase tracking-widest">{VOICE_CORES[selectedVoiceKey].name.split(' ')[0]} Speaking</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isMuted && (
                      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-end space-x-1 h-8">
                        {[1,2,3,4,5,6,7,8].map(i => (
                          <div key={i} className="w-1 bg-blue-400 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}></div>
                        ))}
                      </div>
                    )}
                    <div className="self-center bg-black/80 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-md text-center max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                       <p className="text-[8px] uppercase font-black text-blue-400 mb-1 tracking-widest">Ghost Directive</p>
                       <p className="text-lg font-black text-white uppercase italic drop-shadow-lg leading-tight">{encounterState.activeTip}</p>
                    </div>
                 </div>
              )}
            </div>

            <div className="glass-panel rounded-xl p-4 flex items-center justify-between border border-white/10 shadow-lg relative overflow-hidden">
              {isGhostSpeaking && <div className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-pulse w-full"></div>}
              <div className="flex items-center space-x-4">
                 <div className="relative">
                   <button 
                      disabled={status !== ConnectionStatus.CONNECTED || isGhostSpeaking}
                      onMouseDown={() => setIsMuted(false)}
                      onMouseUp={() => setIsMuted(true)}
                      onMouseLeave={() => setIsMuted(true)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${isMuted ? 'bg-slate-800 text-slate-500 hover:bg-slate-700' : 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]'} ${isGhostSpeaking ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title={isGhostSpeaking ? "AI Transmitting - Mic Blocked" : "Hold 'V' for PTT"}
                   >
                     <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone-lines animate-pulse'}`}></i>
                     {!isMuted && !isGhostSpeaking && <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30"></span>}
                   </button>
                   <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded text-[7px] font-black text-blue-400 uppercase tracking-tighter shadow-lg">V</span>
                 </div>
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Comms Management</p>
                    <p className={`text-[10px] ${status === ConnectionStatus.CONNECTED ? (isGhostSpeaking ? 'text-blue-300 italic' : (isMuted ? 'text-amber-500' : 'text-blue-400 font-bold')) : 'text-slate-600'} uppercase tracking-tight`}>
                      {status === ConnectionStatus.CONNECTED ? (isGhostSpeaking ? `${VOICE_CORES[selectedVoiceKey].name} Transmitting...` : (isMuted ? "Hold 'V' to Speak" : 'Uplink: Listening')) : 'Link Offline'}
                    </p>
                 </div>
              </div>
              <div className="flex items-center space-x-3">
                {isGhostSpeaking && (
                  <div className="flex items-center space-x-1 mr-4">
                    <div className="w-1 h-3 bg-blue-500 animate-[bounce_1s_infinite_0.1s]"></div>
                    <div className="w-1 h-5 bg-blue-500 animate-[bounce_1s_infinite_0.2s]"></div>
                    <div className="w-1 h-3 bg-blue-500 animate-[bounce_1s_infinite_0.3s]"></div>
                  </div>
                )}
                {status === ConnectionStatus.CONNECTED && (
                  <button onClick={handleStopSession} className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-black rounded uppercase tracking-widest transition-all">Terminate</button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Right: Feed & Log */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
            <div className="glass-panel rounded-xl p-5 border border-white/10 flex flex-col flex-1 overflow-hidden shadow-2xl">
               <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Tactical Log</h3>
                  <i className="fas fa-list-ul text-slate-700"></i>
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 custom-scrollbar">
                 {messages.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center opacity-10">
                      <i className="fas fa-ghost text-3xl mb-2"></i>
                      <p className="text-[8px] font-black uppercase tracking-widest">Awaiting Uplink</p>
                   </div>
                 ) : messages.map((msg, idx) => (
                   <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                     <div className={`max-w-[90%] p-3 rounded-xl text-[11px] leading-snug shadow-lg ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-none'}`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}
               </div>
               <div className="relative">
                 <input 
                  type="text" 
                  placeholder={isGhostSpeaking ? `${VOICE_CORES[selectedVoiceKey].name.split(' ')[0]} is speaking...` : (isMuted ? "Hold 'V' or type here..." : "Listening...")}
                  disabled={status !== ConnectionStatus.CONNECTED || isGhostSpeaking}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-[10px] font-bold focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-30 placeholder:text-slate-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim() && sessionRef.current) {
                      const t = e.currentTarget.value;
                      setMessages(p => [...p, { role: 'user', text: t, timestamp: Date.now() }]);
                      sessionRef.current.sendRealtimeInput({ text: t });
                      e.currentTarget.value = '';
                    }
                  }}
                 />
                 <i className="fas fa-paper-plane absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 text-[10px]"></i>
               </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
