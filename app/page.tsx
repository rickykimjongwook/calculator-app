"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const buttons = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", "="],
];

const operatorKeys = ["÷", "×", "-", "+"];

type Calculation = {
  id: number;
  expression: string;
  result: string;
  created_at: string;
};

export default function Home() {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [justCalculated, setJustCalculated] = useState(false);
  const [history, setHistory] = useState<Calculation[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const { data } = await supabase
      .from("calculations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setHistory(data);
  }

  async function saveCalculation(expr: string, result: string) {
    await supabase.from("calculations").insert({ expression: expr, result });
    fetchHistory();
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
    </div>
  );
}
