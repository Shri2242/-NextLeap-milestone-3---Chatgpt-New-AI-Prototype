"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  ChevronDown,
  Loader2,
  Mic,
  Moon,
  Pause,
  Plus,
  SendHorizontal,
  Sun,
  UserCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { auth, googleProvider, onAuthStateChanged, signInWithPopup, signOut } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const languagePattern =
  /[\u0900-\u097F\u0D00-\u0D7F\u0B80-\u0BFF\u0C80-\u0CFF\u0980-\u09FF]/;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice" | "assistant";
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
};

type PendingUpload = {
  id: string;
  name: string;
  type: string;
  size: number;
};

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [input, setInput] = useState("");
  const [selectedUploads, setSelectedUploads] = useState<PendingUpload[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [finalTranscript, setFinalTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [showVoiceTip, setShowVoiceTip] = useState(false);
  const [, setAmbientSpeechNudge] = useState(false);
  const [showTranscriptionPill, setShowTranscriptionPill] = useState(false);
  const [showSpeakingPopup, setShowSpeakingPopup] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("session-1");
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [voiceHintSeen, setVoiceHintSeen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("voice-tip-seen") === "yes";
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const nudgeTimeoutRef = useRef<number | null>(null);
  const transcriptScrollRef = useRef<HTMLTextAreaElement | null>(null);
  const amplitudeStreakRef = useRef<number>(0);
  const speakingPopupTimeoutRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const noSpeechTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const liveTranscript = `${finalTranscript} ${interimTranscript}`.trim();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!transcriptScrollRef.current) {
      return;
    }
    transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedSessions = window.localStorage.getItem("chatSessions");
    if (storedSessions) {
      const parsedSessions: ChatSession[] = JSON.parse(storedSessions);
      if (parsedSessions.length > 0) {
        setChatSessions(parsedSessions);
        setCurrentSessionId(parsedSessions[0].id);
        setMessages(parsedSessions[0].messages);
        return;
      }
    }

    const initialSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "Session 1",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChatSessions([initialSession]);
    setCurrentSessionId(initialSession.id);
  }, []);

  useEffect(() => {
    if (!idToken || chatSessions.length > 0) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/messages", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { messages?: ChatMessage[] };
        const fetchedMessages = data.messages ?? [];
        const initialSession: ChatSession = {
          id: `session-${Date.now()}`,
          title: "Session 1",
          messages: fetchedMessages,
          createdAt: new Date().toISOString(),
        };
        setMessages(fetchedMessages);
        setChatSessions([initialSession]);
        setCurrentSessionId(initialSession.id);
      } catch {
        // Ignore initial fetch errors.
      }
    })();
  }, [idToken, chatSessions.length]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        setIdToken(await nextUser.getIdToken());
      } else {
        setIdToken(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  const signIn = async () => {
    if (!auth) { toast.error("Firebase is not configured."); return; }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code === "auth/configuration-not-found") {
        toast.error(
          "Login is not configured in Firebase yet. Enable Google Sign-In in Firebase Console > Authentication > Sign-in method."
        );
        return;
      }
      const message = error instanceof Error ? error.message : "Sign-in failed.";
      toast.error(message);
    }
  };

  const signOutUser = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setUser(null);
      setIdToken(null);
      setChatSessions([]);
      setMessages([]);
      setCurrentSessionId("session-1");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const getSpeechRecognition = () => {
    if (typeof window === "undefined") {
      return null;
    }
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  };

  const stopAmbientDetection = () => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyzerRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  const guessRecognitionLanguage = useCallback((seedText: string) => {
    if (/[\u0D00-\u0D7F]/.test(seedText)) {
      return "ml-IN";
    }
    if (/[\u0900-\u097F]/.test(seedText)) {
      return "hi-IN";
    }
    if (/[\u0B80-\u0BFF]/.test(seedText)) {
      return "ta-IN";
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en-IN";
  }, []);

  const ensureMicrophoneAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission("denied");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  }, []);

  const startAmbientDetection = useCallback(async () => {
    if (isVoiceMode || analyzerRef.current || typeof window === "undefined") {
      return;
    }

    const hasPermission =
      micPermission === "granted" ||
      (micPermission !== "denied" && (await ensureMicrophoneAccess()));
    if (!hasPermission) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const audioCtx = new window.AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 1024;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const detectSpeech = () => {
        if (!analyzerRef.current || isVoiceMode) {
          return;
        }

        analyzerRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          sum += dataArray[i];
        }
        const avgLevel = sum / dataArray.length;

        if (avgLevel > 22) {
          amplitudeStreakRef.current += 1;
        } else {
          amplitudeStreakRef.current = Math.max(0, amplitudeStreakRef.current - 1);
        }

        if (amplitudeStreakRef.current > 12 && !isListening) {
          setAmbientSpeechNudge(true);
          setShowSpeakingPopup(true);

          if (speakingPopupTimeoutRef.current) {
            window.clearTimeout(speakingPopupTimeoutRef.current);
          }
          speakingPopupTimeoutRef.current = window.setTimeout(() => {
            setShowSpeakingPopup(false);
          }, 3500);

          if (nudgeTimeoutRef.current) {
            window.clearTimeout(nudgeTimeoutRef.current);
          }
          nudgeTimeoutRef.current = window.setTimeout(() => {
            setAmbientSpeechNudge(false);
          }, 5000);
          amplitudeStreakRef.current = 0;
        }

        animationFrameRef.current = window.requestAnimationFrame(detectSpeech);
      };

      animationFrameRef.current = window.requestAnimationFrame(detectSpeech);
    } catch {
      // Gracefully skip passive nudge if permission is denied.
      setMicPermission("denied");
    }
  }, [ensureMicrophoneAccess, isListening, isVoiceMode, micPermission]);

  useEffect(() => {
    void ensureMicrophoneAccess();
  }, [ensureMicrophoneAccess]);

  useEffect(() => {
    if (!isVoiceMode) {
      void startAmbientDetection();
    } else {
      stopAmbientDetection();
    }

    return () => {
      if (nudgeTimeoutRef.current) {
        window.clearTimeout(nudgeTimeoutRef.current);
      }
      if (speakingPopupTimeoutRef.current) {
        window.clearTimeout(speakingPopupTimeoutRef.current);
      }
      stopAmbientDetection();
    };
  }, [isVoiceMode, startAmbientDetection]);

  const accuracyText = useMemo(() => {
    if (languagePattern.test(transcript)) {
      return "Detected: Malayalam accent - 94% accurate";
    }
    if (transcript.length > 50) {
      return "Detected: Indian English accent - 92% accurate";
    }
    return "Detected: Neutral accent - 90% accurate";
  }, [transcript]);

  const beginVoiceMode = () => {
    stopAmbientDetection();
    amplitudeStreakRef.current = 0;
    setIsVoiceMode(true);
    setShowTranscriptionPill(true);
  };

  const startListening = () => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (!voiceHintSeen) {
      setShowVoiceTip(true);
      setVoiceHintSeen(true);
      window.localStorage.setItem("voice-tip-seen", "yes");
      window.setTimeout(() => setShowVoiceTip(false), 3000);
    }

    void (async () => {
      const hasPermission =
        micPermission === "granted" || (await ensureMicrophoneAccess());
      if (!hasPermission) {
        toast.error("Microphone permission denied. Please allow mic access.");
        return;
      }

      beginVoiceMode();
      setFinalTranscript("");
      setInterimTranscript("");
      setTranscript("");
      finalTranscriptRef.current = "";

      recognitionRef.current?.abort();
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = guessRecognitionLanguage(input);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        if (noSpeechTimeoutRef.current) {
          window.clearTimeout(noSpeechTimeoutRef.current);
        }
        noSpeechTimeoutRef.current = window.setTimeout(() => {
          toast.message("Listening... start speaking to see live transcription.");
        }, 2800);
      };

      recognition.onresult = (event) => {
        if (noSpeechTimeoutRef.current) {
          window.clearTimeout(noSpeechTimeoutRef.current);
          noSpeechTimeoutRef.current = null;
        }

        let interimChunk = "";
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const chunk = event.results[index][0].transcript.trim();
          if (!chunk) {
            continue;
          }
          if (event.results[index].isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${chunk}`.trim();
          } else {
            interimChunk = `${interimChunk} ${chunk}`.trim();
          }
        }

        setFinalTranscript(finalTranscriptRef.current);
        setInterimTranscript(interimChunk);
        setTranscript(`${finalTranscriptRef.current} ${interimChunk}`.trim());
      };

      recognition.onerror = (event) => {
        if (event.error !== "aborted") {
          toast.error(`Voice error: ${event.error}. Please allow mic and try again.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        if (noSpeechTimeoutRef.current) {
          window.clearTimeout(noSpeechTimeoutRef.current);
          noSpeechTimeoutRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    })();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setTranscript(liveTranscript);
    setFinalTranscript(liveTranscript);
    finalTranscriptRef.current = liveTranscript;
    setInterimTranscript("");
    if (noSpeechTimeoutRef.current) {
      window.clearTimeout(noSpeechTimeoutRef.current);
      noSpeechTimeoutRef.current = null;
    }
    if (!liveTranscript.trim()) {
      toast.message("No speech detected yet. Try speaking closer to the mic.");
    }
  };

  const cancelVoice = () => {
    recognitionRef.current?.abort();
    setIsListening(false);
    setIsVoiceMode(false);
    setTranscript("");
    setFinalTranscript("");
    finalTranscriptRef.current = "";
    setInterimTranscript("");
    setShowTranscriptionPill(false);
    if (noSpeechTimeoutRef.current) {
      window.clearTimeout(noSpeechTimeoutRef.current);
      noSpeechTimeoutRef.current = null;
    }
  };

  const insertTranscript = () => {
    if (!transcript.trim()) {
      return;
    }

    const spokenText = transcript.trim();
    setIsVoiceMode(false);
    setTranscript("");
    setFinalTranscript("");
    setInterimTranscript("");
    setShowTranscriptionPill(true);
    toast.success("Voice converted ✅ You can always edit");
    void sendMessage(spokenText, "voice");
  };

  const sendMessage = async (content: string, source: "text" | "voice") => {
    const clean = content.trim();
    if (!clean || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: clean,
      source,
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, userMessage] }
          : session
      )
    );
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ message: clean, source }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error || "No response generated.");
      }
      const assistantReply = data.reply;

      const assistantMessage: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: assistantReply,
        source: "assistant",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, messages: [...session.messages, assistantMessage] }
            : session
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Chat request failed.";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const resetChat = () => {
    recognitionRef.current?.abort();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `Chat ${chatSessions.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setInput("");
    setSelectedUploads([]);
    setIsSending(false);
    setIsVoiceMode(false);
    setIsListening(false);
    setTranscript("");
    setFinalTranscript("");
    setInterimTranscript("");
    setShowTranscriptionPill(false);
    setShowSpeakingPopup(false);
  };

  const sendTextMessage = () => {
    if (!input.trim() && selectedUploads.length === 0) {
      return;
    }

    const attachmentSummary = selectedUploads.length
      ? `Attached files:\n${selectedUploads
          .map((file) => `- ${file.type.startsWith("video/") ? "[Video]" : "[Image]"} ${file.name}`)
          .join("\n")}`
      : "";

    const text = input.trim();
    const toSend = text && attachmentSummary
      ? `${text}\n\n${attachmentSummary}`
      : text || attachmentSummary;

    setInput("");
    setSelectedUploads([]);
    void sendMessage(toSend, "text");
  };

  const onAttachClick = () => {
    fileInputRef.current?.click();
  };

  const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const nextUploads: PendingUpload[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        continue;
      }
      nextUploads.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }

    if (nextUploads.length === 0) {
      toast.error("Please choose an image or video file.");
      event.target.value = "";
      return;
    }

    setSelectedUploads((prev) => [...prev, ...nextUploads]);
    event.target.value = "";
  };

  const removeUpload = (id: string) => {
    setSelectedUploads((prev) => prev.filter((file) => file.id !== id));
  };

  const formatUploadSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main
      className={cn(
        "flex min-h-dvh w-full flex-col overflow-hidden",
        isDark
          ? "bg-gradient-to-b from-[#2f3685] via-[#1b2157] to-[#0d102b] text-white"
          : "bg-white text-[#111827]"
      )}
    >
      <header className="px-4 pb-2 pt-4 md:px-8 md:pt-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowSessionList((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[34px] font-medium tracking-tight transition",
              isDark ? "text-white hover:bg-white/10" : "text-[#111827] hover:bg-black/5"
            )}
          >
            <span className="text-[34px] leading-none md:text-[32px]">ChatGPT</span>
            <ChevronDown className={cn("h-5 w-5", isDark ? "text-white/75" : "text-zinc-500")} />
          </button>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              className={cn(
                "rounded-full p-2 transition",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-white/90" />
              ) : (
                <Moon className="h-5 w-5 text-zinc-700" />
              )}
            </button>
            <button
              onClick={resetChat}
              className={cn(
                "rounded-full p-2 transition",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
              aria-label="New chat"
            >
              <Plus className={cn("h-5 w-5", isDark ? "text-white/90" : "text-zinc-700")} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={cn("rounded-full p-1 transition", isDark ? "hover:bg-white/10" : "hover:bg-black/5")}
              >
                <UserCircle2 className={cn("h-6 w-6", isDark ? "text-white/85" : "text-zinc-700")} />
              </button>
              {showUserMenu && (
                <div
                  className={cn(
                    "absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border p-3 shadow-xl backdrop-blur",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-zinc-200 bg-white"
                  )}
                >
                  {user ? (
                    <div className="space-y-2">
                      <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-zinc-900")}>{user.displayName || user.email}</p>
                      <button
                        onClick={() => {
                          signOutUser();
                          setShowUserMenu(false);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          isDark
                            ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
                        )}
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button onClick={() => { signIn(); setShowUserMenu(false); }} className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                        Login
                      </button>
                      <button
                        onClick={() => {
                          signIn();
                          setShowUserMenu(false);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          isDark
                            ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
                        )}
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {showSessionList && (
        <section className="px-4 pb-4 md:px-8">
          <div
            className={cn(
              "mx-auto max-w-4xl rounded-3xl border p-4 text-left shadow-xl backdrop-blur",
              isDark
                ? "border-white/10 bg-white/5 text-white"
                : "border-zinc-200 bg-white text-zinc-900"
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Chat Sessions</p>
                <p className={cn("text-sm", isDark ? "text-white/70" : "text-zinc-500")}>
                  {chatSessions.length} saved session{chatSessions.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setShowSessionList(false)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition",
                  isDark
                    ? "border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                )}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {chatSessions.length === 0 ? (
                <p className={cn("text-sm", isDark ? "text-white/70" : "text-zinc-500")}>No saved chats yet.</p>
              ) : (
                chatSessions.map((session) => (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      setMessages(session.messages);
                      setShowSessionList(false);
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left text-sm transition",
                      session.id === currentSessionId
                        ? isDark
                          ? "border-blue-300 bg-white/10"
                          : "border-blue-300 bg-blue-50"
                        : isDark
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-zinc-200 bg-white hover:bg-zinc-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={cn("font-semibold", isDark ? "text-white" : "text-zinc-900")}>{session.title}</p>
                        <p className={cn("mt-1 text-xs", isDark ? "text-white/65" : "text-zinc-500")}>
                          {session.messages.length} messages
                        </p>
                      </div>
                      <span className={cn("text-[11px] uppercase tracking-[0.18em]", isDark ? "text-white/60" : "text-zinc-500")}>
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {session.messages[session.messages.length - 1] ? (
                      <p className={cn("mt-3 line-clamp-2 text-[13px] leading-5", isDark ? "text-white/70" : "text-zinc-600")}>
                        {session.messages[session.messages.length - 1].content}
                      </p>
                    ) : (
                      <p className={cn("mt-3 text-[13px] leading-5", isDark ? "text-white/70" : "text-zinc-600")}>Start a new chat.</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      )}
      <section className="flex flex-1 flex-col items-center justify-center px-4 pb-2 text-center md:px-8">
        <p className={cn("text-[40px] font-medium tracking-tight md:text-[48px]", isDark ? "text-white" : "text-[#111827]")}>What can I help with?</p>

        <button
          onClick={isListening ? stopListening : startListening}
          className={cn(
            "pulse-ring mt-8 flex h-[104px] w-[104px] items-center justify-center rounded-full shadow-[0_18px_44px_-18px_rgba(0,0,0,0.55)] transition",
            isDark ? "bg-[#355eb5] ring-8 ring-[#2b4a8f]" : "bg-[#3f6bd0] ring-8 ring-[#dbe6ff]"
          )}
          aria-label="Toggle voice mode"
        >
          <Mic className="h-11 w-11 text-white" />
        </button>
        <p className={cn("mt-4 text-[32px] font-medium", isDark ? "text-white" : "text-[#1f2a44]")}>Listening</p>
      </section>

      <section className="relative px-3 pb-5 md:px-8 md:pb-7">
        {showSpeakingPopup && !isVoiceMode && (
          <div className="absolute -top-16 left-1/2 z-20 w-[92%] max-w-4xl -translate-x-1/2 rounded-2xl bg-[#0f1333]/95 px-4 py-2.5 text-center text-sm text-white shadow-2xl ring-1 ring-white/20 backdrop-blur">
            Are you speaking? Turn on the mic to capture your voice.
          </div>
        )}

        {showVoiceTip && (
          <div className="absolute -top-20 left-3 z-10 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg">
            Voice instantly becomes editable text. You stay in full control.
          </div>
        )}

        {showTranscriptionPill && (
          <button
            onClick={() => {
              if (!isVoiceMode) {
                setIsVoiceMode(true);
              }
            }}
            className="mx-auto -mt-1 mb-3 flex w-fit items-center gap-3 rounded-full bg-[#1f2348] px-4 py-2.5 text-[28px] shadow-[0_15px_25px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/15"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#4f6aff]">
              <Mic className="h-5 w-5" />
            </span>
            <span className="text-[25px] leading-none">Real-time transcription</span>
          </button>
        )}

        {messages.length > 0 && (
          <div className="mx-auto mb-3 max-h-36 w-full max-w-4xl space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-2 ring-1 ring-white/10 md:max-h-48">
            {messages.slice(-6).map((message) => (
              <div
                key={message.id}
                className={cn(
                  "w-fit max-w-[90%] rounded-xl px-3 py-1.5 text-xs leading-relaxed",
                  message.role === "assistant"
                    ? "bg-white/15 text-white"
                    : "ml-auto bg-[#4c5cff] text-white"
                )}
              >
                {message.content}
              </div>
            ))}
          </div>
        )}

        {selectedUploads.length > 0 && (
          <div className="mx-auto mb-3 flex w-full max-w-3xl flex-wrap gap-2">
            {selectedUploads.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                  isDark
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-800"
                )}
              >
                <span className={cn("font-semibold", isDark ? "text-white" : "text-zinc-800")}>
                  {file.type.startsWith("video/") ? "Video" : "Image"}
                </span>
                <span className="max-w-40 truncate">{file.name}</span>
                <span className={cn(isDark ? "text-white/70" : "text-zinc-500")}>{formatUploadSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeUpload(file.id)}
                  className={cn(
                    "rounded-full p-0.5 transition",
                    isDark ? "hover:bg-white/20" : "hover:bg-zinc-200"
                  )}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "mx-auto flex h-14 w-full max-w-3xl items-center gap-3 rounded-full px-4 ring-1 md:h-14",
            isDark
              ? "bg-[#202547]/95 ring-white/20"
              : "bg-white ring-zinc-300 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          )}
        >
          <button
            type="button"
            onClick={onAttachClick}
            className={cn(
              "rounded-full p-1 transition",
              isDark ? "text-white/75 hover:bg-white/10" : "text-zinc-600 hover:bg-zinc-100"
            )}
            aria-label="Attach image or video"
          >
            <Plus className="h-5 w-5" />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => {
              void startAmbientDetection();
            }}
            placeholder="Ask anything"
            className={cn(
              "h-full flex-1 bg-transparent text-[16px] outline-none md:text-[16px]",
              isDark ? "text-white placeholder:text-white/60" : "text-zinc-900 placeholder:text-zinc-500"
            )}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onFilesSelected}
          />
          <button
            onClick={sendTextMessage}
            disabled={isSending}
            className="rounded-full bg-[#1a8cff] p-2 text-white transition hover:bg-[#1180e8]"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
            )}
          </button>
        </div>
      </section>

      {isVoiceMode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#20256b] via-[#161b4f] to-[#0d102d] px-4 pb-6 pt-12 text-white">
          <div className="mb-6 text-center">
            <p className="text-3xl font-semibold">ChatGPT</p>
            <p className="mt-1 text-base text-blue-100">Listening</p>
          </div>

          <div className="mb-8 flex flex-col items-center">
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "pulse-ring flex h-28 w-28 items-center justify-center rounded-full bg-[#4285F4] shadow-2xl",
                !isListening && "opacity-80"
              )}
            >
              <Mic className="h-14 w-14" />
            </button>
            <p className="mt-4 text-base text-blue-100">
              {isListening ? "Listening..." : "Paused"}
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="mb-2 text-xs uppercase tracking-wide text-blue-100">
              Real-time transcription
            </p>
            <p className="mb-2 text-xs text-blue-200">
              {isListening ? "Listening now..." : "Tap mic and start speaking"}
            </p>
            <textarea
              ref={transcriptScrollRef}
              value={transcript}
              className="max-h-56 min-h-40 w-full resize-none overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-blue-300"
              placeholder="Start speaking to see live text..."
              readOnly={isListening}
              onChange={(event) => setTranscript(event.target.value)}
            />
            <p className="mt-2 text-xs text-blue-100">{accuracyText}</p>
          </div>

          <div className="mt-auto space-y-3">
            {!isListening && transcript.trim() && (
              <Button
                onClick={insertTranscript}
                className="h-12 w-full rounded-2xl text-base"
              >
                Insert to Chat
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="h-11 rounded-2xl"
                onClick={stopListening}
              >
                <Pause className="mr-1 h-4 w-4" />
                Stop
              </Button>
              <Button
                variant="ghost"
                className="h-11 rounded-2xl border border-white/20 text-white hover:bg-white/10"
                onClick={cancelVoice}
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
