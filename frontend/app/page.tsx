'use client';
import { useState, useEffect } from 'react';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
};

type AnalysisResult = {
  filename: string;
  summary: string;
  extracted_text?: string;
  mcqs: {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
  }[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analyzing with AI...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: string }>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Load from localStorage safely after initial render 📂
  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      const savedResult = localStorage.getItem('studysync_result');
      const savedChat = localStorage.getItem('studysync_chat');

      if (savedResult) {
        try {
          const parsedResult: AnalysisResult = JSON.parse(savedResult);
          setResult(parsedResult);
        } catch (e) {
          console.error("Error parsing saved result", e);
        }
      }

      if (savedChat) {
        try {
          const parsedChat: ChatMessage[] = JSON.parse(savedChat);
          setChatMessages(parsedChat);
        } catch (e) {
          console.error("Error parsing saved chat", e);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Save result to localStorage 💾
  useEffect(() => {
    if (result) {
      localStorage.setItem('studysync_result', JSON.stringify(result));
    }
  }, [result]);

  // Save chatMessages to localStorage 💬
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('studysync_chat', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setSelectedOptions({});
    setChatMessages([]);
    
    setLoadingText('Extracting PDF text... 📄');
    setTimeout(() => setLoadingText('Generating Smart Summary & Quizzes with Gemini AI... 🧠'), 1000);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://studysync-backend-a3zj.onrender.com', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error uploading file:", err);
    } finally {
      setLoading(false);
      setLoadingText('Analyzing with AI...');
    }
  };

  const handleOptionClick = (questionIndex: number, option: string) => {
    setSelectedOptions({ ...selectedOptions, [questionIndex]: option });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !result?.extracted_text) return;

    const userQuestion = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userQuestion }]);
    setChatLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/chat-doc/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.extracted_text, question: userQuestion }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { sender: 'ai', text: data.answer }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I couldn't process your request." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownloadNotes = () => {
    if (!result) return;
    const htmlContent = `
      <html>
        <head>
          <title>${result.filename} - StudySync Notes</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; line-height: 1.6; }
            h1 { color: #4F46E5; }
            h2 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 5px; }
            .mcq { background: #F3F4F6; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>🧠 StudySync AI - Study Notes</h1>
          <p><strong>File Name:</strong> ${result.filename}</p>
          <h2>📄 Executive Summary</h2>
          <p>${result.summary}</p>
          <h2>📝 Mock Test Quiz & Explanations</h2>
          ${result.mcqs.map((q, idx) => `
            <div class="mcq">
              <p><strong>Q${idx + 1}:${q.question}</strong></p>
              <ul>${q.options.map(opt => `<li>${opt}</li>`).join('')}</ul>
              <p><strong>Correct Answer:</strong> ${q.answer}</p>
              <p><strong>Explanation:</strong> ${q.explanation}</p>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.filename.replace('.pdf', '')}_StudyNotes.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalQuestions = result?.mcqs?.length || 0;
  const answeredCount = Object.keys(selectedOptions).length;
  const correctCount = result?.mcqs?.reduce((acc, q, idx) => {
    return selectedOptions[idx] === q.answer ? acc + 1 : acc;
  }, 0) || 0;

  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-indigo-400">🧠 StudySync AI</h1>
        <p className="text-slate-400 mb-6">Transform your study materials into smart summaries, interactive quizzes, instant chat, and study notes for WebNova 2026.</p>
        
        <form onSubmit={handleUpload} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-lg">
          <input 
            type="file" 
            accept=".pdf" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
          />
          <button 
            type="submit" 
            disabled={loading || !file} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-lg font-medium transition duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{loadingText}</span>
              </>
            ) : (
              <span>Upload & Analyze Document 🚀</span>
            )}
          </button>
        </form>

        {result && (
          <div className="mt-8 space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
              <span className="text-sm text-slate-300">📁 <strong>{result.filename}</strong> analyzed successfully</span>
              <button 
                onClick={handleDownloadNotes}
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center space-x-2 cursor-pointer"
              >
                <span>📥 Download Study Notes</span>
              </button>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h2 className="text-xl font-semibold text-emerald-400 mb-3">📄 Analysis Results</h2>
              <div className="p-4 bg-slate-900 rounded-lg">
                <h3 className="font-semibold text-indigo-300 mb-2">Executive Summary:</h3>
                <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{result.summary}</p>
              </div>
            </div>

            {result.mcqs && result.mcqs.length > 0 && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-indigo-400">📝 Mock Test Quiz (MCQs)</h3>
                  <span className="text-xs bg-indigo-900/60 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700 font-medium">
                    Attempted: {answeredCount}/{totalQuestions}
                  </span>
                </div>

                {result.mcqs.map((q, qIndex) => {
                  const isAnswered = selectedOptions[qIndex] !== undefined;
                  const userChoice = selectedOptions[qIndex];

                  return (
                    <div key={qIndex} className="space-y-3 bg-slate-900 p-5 rounded-lg mb-4 border border-slate-700">
                      <p className="font-medium text-slate-200">{qIndex + 1}. {q.question}</p>
                      
                      <div className="grid grid-cols-1 gap-2 mt-3">
                        {q.options.map((opt: string, i: number) => {
                          let btnStyle = "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 cursor-pointer";
                          if (isAnswered) {
                            if (opt === q.answer) btnStyle = "bg-emerald-900/50 text-emerald-300 border-emerald-500";
                            else if (opt === userChoice) btnStyle = "bg-rose-900/50 text-rose-300 border-rose-500";
                          }

                          return (
                            <button
                              key={i}
                              onClick={() => handleOptionClick(qIndex, opt)}
                              disabled={isAnswered}
                              className={`w-full text-left text-sm p-3 rounded border transition duration-200 ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswered && (
                        <div className="mt-3 p-3 bg-slate-800/80 rounded border border-slate-700 text-sm">
                          <p className={`font-semibold ${userChoice === q.answer ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {userChoice === q.answer ? '✅ Correct!' : '❌ Incorrect!'}
                          </p>
                          <p className="text-slate-300 mt-1 text-xs"><strong>Explanation:</strong> {q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isAllAnswered && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-indigo-900/40 to-emerald-900/40 rounded-xl border border-indigo-500/50 text-center space-y-2">
                    <h4 className="text-lg font-bold text-indigo-300">🎉 Quiz Completed!</h4>
                    <p className="text-2xl font-extrabold text-white">
                      Your Score: <span className="text-emerald-400">{correctCount}</span> / <span className="text-indigo-400">{totalQuestions}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h3 className="text-xl font-semibold text-cyan-400 mb-3">💬 Chat with Document (AI Assistant)</h3>
              <div className="bg-slate-900 p-4 rounded-lg mb-4 max-h-80 overflow-y-auto space-y-3 border border-slate-700">
                {chatMessages.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No messages yet. Ask anything about the document!</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                        <p className="whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-400 p-3 rounded-lg text-sm border border-slate-700 animate-pulse">
                      Thinking... 🤖
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about the PDF..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 px-5 py-2 rounded-lg text-sm font-medium transition duration-200 disabled:opacity-50 cursor-pointer"
                >
                  Send 🚀
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}