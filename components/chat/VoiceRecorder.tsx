"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Send, Play, Pause } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface VoiceRecorderProps {
  onAudioReady: (audioBlob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onAudioReady, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Start recording immediately when mounted
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const startRecording = async () => {
    try {
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setPreviewUrl(url);
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Unable to access microphone. Please ensure microphone permissions are granted in your browser.");
      onCancel();
    }
  };

  const stopRecordingForReview = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleSend = () => {
    if (recordedBlob) {
      onAudioReady(recordedBlob, seconds);
      cleanup();
    } else if (isRecording && mediaRecorderRef.current) {
      // If still recording when user hits send, stop and get blob
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        onAudioReady(audioBlob, seconds);
        cleanup();
      };
      mediaRecorderRef.current.stop();
    }
  };

  const handleTogglePreview = () => {
    if (!audioPreviewRef.current && previewUrl) {
      const audio = new Audio(previewUrl);
      audio.onended = () => setIsPlayingPreview(false);
      audioPreviewRef.current = audio;
    }

    if (audioPreviewRef.current) {
      if (isPlayingPreview) {
        audioPreviewRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        audioPreviewRef.current.play();
        setIsPlayingPreview(true);
      }
    }
  };

  return (
    <div className="flex items-center w-full bg-emerald-50 dark:bg-chat-darkIn rounded-2xl px-4 py-2.5 border border-brand-200 dark:border-chat-darkBorder shadow-sm gap-3">
      {/* Cancel button */}
      <button
        type="button"
        onClick={() => {
          cleanup();
          onCancel();
        }}
        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-full transition-colors"
        title="Discard recording"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording Status & Waveform */}
      <div className="flex-1 flex items-center gap-3">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-sm font-semibold text-red-600 dark:text-red-400">
              {formatDuration(seconds)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePreview}
              className="p-1.5 rounded-full bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <span className="font-mono text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {formatDuration(seconds)}
            </span>
          </div>
        )}

        {/* Animated Sound Bars */}
        <div className="flex-1 flex items-center justify-center gap-1 h-6">
          {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 85, 40, 65].map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isRecording ? "bg-brand-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
              style={{
                height: isRecording ? `${Math.max(20, (h * (Math.sin(i + seconds * 2) + 1.2)) / 2)}%` : `${h * 0.4}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Stop / Send Button */}
      {isRecording ? (
        <button
          type="button"
          onClick={stopRecordingForReview}
          className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
          title="Pause & review"
        >
          <Square className="w-5 h-5" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleSend}
        className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-md transition-transform hover:scale-105"
        title="Send voice note"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
