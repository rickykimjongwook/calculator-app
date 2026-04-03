"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const buttons = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", "="],
];

const operatorKeys = ["÷", "×", "-", "+"];

const FIXED_PASS = "calc-app-fixed-password-2024";
const ID_REGEX = /^[a-z0-9]{1,10}$/;

type Calculation = {
  id: number;
  expression: string;
  result: string;
  created_at: string;
  user_id?: string;
};

function getUserDisplayId(u: User): string {
  return u.email?.split("@")[0] ?? "unknown";
}

function validateId(id: string): string | null {
  if (!ID_REGEX.test(id)) return "ID는 영어 소문자와 숫자만, 10자 이하로 입력하세요";
  return null;
}

export default function Home() {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [justCalculated, setJustCalculated] = useState(false);
  const [history, setHistory] = useState<Calculation[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      fetchHistory(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        fetchHistory(currentUser);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchHistory(currentUser: User | null) {
    if (currentUser) {
      const { data } = await supabase
        .from("calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setHistory(data);
    } else {
      const raw = localStorage.getItem("calc_history");
      const local: Calculation[] = raw ? JSON.parse(raw) : [];
      setHistory(local.slice(0, 5));
    }
  }

  async function saveCalculation(expr: string, result: string) {
    if (user) {
      await supabase
        .from("calculations")
        .insert({ expression: expr, result, user_id: user.id });
      fetchHistory(user);
    } else {
      const raw = localStorage.getItem("calc_history");
      const local: Calculation[] = raw ? JSON.parse(raw) : [];
      const newEntry: Calculation = {
        id: Date.now(),
        expression: expr,
        result,
        created_at: new Date().toISOString(),
      };
      const updated = [newEntry, ...local].slice(0, 20);
      localStorage.setItem("calc_history", JSON.stringify(updated));
      setHistory(updated.slice(0, 5));
    }
  }

  async function handleLogin() {
    const err = validateId(authInput);
    if (err) { setAuthError(err); return; }
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: `${authInput}@calc.app`,
      password: FIXED_PASS,
    });
    if (error) setAuthError("존재하지 않는 ID입니다");
    else { setShowAuthModal(false); setAuthInput(""); }
    setAuthLoading(false);
  }

  async function handleSignUp() {
    const err = validateId(authInput);
    if (err) { setAuthError(err); return; }
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signUp({
      email: `${authInput}@calc.app`,
      password: FIXED_PASS,
    });
    if (error) {
      setAuthError(
        error.message.includes("already registered")
          ? "이미 사용 중인 ID입니다"
          : "가입 중 오류가 발생했습니다"
      );
    } else {
      setShowAuthModal(false);
      setAuthInput("");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function handleButton(value: string) {
    if (value === "C") {
      setExpression("");
      setDisplay("0");
      setJustCalculated(false);
      return;
    }

    if (value === "±") {
      if (display !== "0") {
        const toggled = display.startsWith("-") ? display.slice(1) : "-" + display;
        setDisplay(toggled);
        setExpression(toggled);
      }
      return;
    }

    if (value === "%") {
      const num = parseFloat(display) / 100;
      setDisplay(String(num));
      setExpression(String(num));
      return;
    }

    if (value === "=") {
      if (!expression) return;
      try {
        const evalExpression = expression
          .replace(/×/g, "*")
          .replace(/÷/g, "/");
        // eslint-disable-next-line no-eval
        const result = eval(evalExpression);
        const resultStr = String(parseFloat(result.toFixed(10)));
        saveCalculation(expression, resultStr);
        setDisplay(resultStr);
        setExpression(resultStr);
        setJustCalculated(true);
      } catch {
        setDisplay("오류");
        setExpression("");
      }
      return;
    }

    if (operatorKeys.includes(value)) {
      setJustCalculated(false);
      const last = expression.slice(-1);
      if (operatorKeys.includes(last)) {
        const newExpr = expression.slice(0, -1) + value;
        setExpression(newExpr);
        setDisplay(value);
      } else {
        setExpression((prev) => prev + value);
        setDisplay(value);
      }
      return;
    }

    if (justCalculated) {
      setExpression(value);
      setDisplay(value);
      setJustCalculated(false);
      return;
    }

    const newExpr = expression + value;
    setExpression(newExpr);
    const parts = newExpr.split(/[+\-×÷]/);
    setDisplay(parts[parts.length - 1] || "0");
  }

  function isOperator(val: string) {
    return operatorKeys.includes(val);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
      {/* 상단 인증 바 */}
      <div className="w-80 flex items-center justify-between px-2">
        {user ? (
          <>
            <span className="text-zinc-400 text-sm">{getUserDisplayId(user)} 님</span>
            <button
              onClick={handleLogout}
              className="text-zinc-500 text-sm hover:text-white transition-colors"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <span className="text-zinc-600 text-sm">비로그인</span>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-amber-400 text-sm hover:text-amber-300 transition-colors"
            >
              로그인 / 가입
            </button>
          </>
        )}
      </div>

      {/* 계산기 */}
      <div className="w-80 rounded-3xl overflow-hidden shadow-2xl bg-black">
        <div className="px-6 pt-12 pb-4 text-right">
          <p className="text-zinc-500 text-sm h-5 truncate">{expression || " "}</p>
          <p className="text-white text-6xl font-light mt-1 truncate">{display}</p>
        </div>

        <div className="grid grid-cols-4 gap-3 p-4">
          {buttons.map((row, rowIdx) =>
            row.map((btn, colIdx) => {
              const isZero = btn === "0";
              const isEq = btn === "=";
              const isOp = isOperator(btn);
              const isTop = rowIdx === 0;

              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  onClick={() => handleButton(btn)}
                  className={[
                    "h-16 rounded-full text-xl font-medium transition-opacity active:opacity-70",
                    isZero ? "col-span-2 text-left pl-6" : "",
                    isOp || isEq ? "bg-amber-400 text-black" : "",
                    isTop && !isOp ? "bg-zinc-500 text-black" : "",
                    !isOp && !isEq && !isTop ? "bg-zinc-800 text-white" : "",
                  ]
                    .join(" ")
                    .trim()}
                >
                  {btn}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 계산 기록 */}
      {history.length > 0 && (
        <div className="w-80">
          <p className="text-zinc-500 text-sm mb-2">최근 계산 기록</p>
          <div className="flex flex-col gap-1">
            {history.map((item) => (
              <div key={item.id} className="flex justify-between text-sm px-2">
                <span className="text-zinc-400">{item.expression}</span>
                <span className="text-white">= {item.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 로그인/가입 모달 */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 w-72 flex flex-col gap-4">
            <h2 className="text-white text-lg font-medium">로그인 / 가입</h2>
            <input
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="ID (영소문자+숫자, 10자 이하)"
              maxLength={10}
              autoFocus
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none placeholder-zinc-600"
            />
            {authError && (
              <p className="text-red-400 text-xs">{authError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleLogin}
                disabled={authLoading}
                className="flex-1 bg-amber-400 text-black rounded-xl py-3 text-sm font-medium disabled:opacity-50"
              >
                로그인
              </button>
              <button
                onClick={handleSignUp}
                disabled={authLoading}
                className="flex-1 bg-zinc-700 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50"
              >
                가입
              </button>
            </div>
            <button
              onClick={() => { setShowAuthModal(false); setAuthError(""); setAuthInput(""); }}
              className="text-zinc-500 text-xs text-center hover:text-zinc-400 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
