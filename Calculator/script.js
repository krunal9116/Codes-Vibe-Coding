const app = document.getElementById("app");
const display = document.getElementById("display");

let expr = "0";

const ops = ["+", "-", "*", "/", "^"];
const isOp = (c) => ops.includes(c);
const last = (s) => s[s.length - 1];

function updateDisplay(v = expr) {
  display.value = v;
}
function setExpression(v) {
  expr = v;
  updateDisplay();
}
function pressFx(button) {
  if (!button) return;
  button.classList.add("pressed");
  setTimeout(() => button.classList.remove("pressed"), 120);
}

function appendValue(v) {
  if (expr === "Error") expr = "0";
  if (expr === "0" && /[0-9.]/.test(v)) {
    expr = v === "." ? "0." : v;
  } else {
    const lc = last(expr);
    if (isOp(v) && isOp(lc)) expr = expr.slice(0, -1) + v;
    else expr += v;
  }
  updateDisplay();
}
function clearAll() {
  setExpression("0");
}
function backspace() {
  if (expr === "Error") return clearAll();
  expr = expr.length <= 1 ? "0" : expr.slice(0, -1);
  updateDisplay();
}

function balanceParentheses(s) {
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open > close) s += ")".repeat(open - close);
  return s;
}
function sanitizeExpression(s) {
  s = balanceParentheses(s.trim());
  while (s.length && (isOp(last(s)) || last(s) === ".")) s = s.slice(0, -1);
  return s || "0";
}

// ---------- Safe Parser / Evaluator ----------
function tokenize(s) {
  const out = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (ch === " ") {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let n = ch;
      i++;
      while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
      if ((n.match(/\./g) || []).length > 1) throw new Error("Invalid number");
      out.push(n);
      continue;
    }

    if ("+-*/^()".includes(ch)) {
      if (
        ch === "-" &&
        (out.length === 0 || ["+", "-", "*", "/", "^", "("].includes(out[out.length - 1]))
      ) {
        i++;
        let n = "-";
        while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
        if (n === "-") {
          out.push("-1");
          out.push("*");
        } else out.push(n);
        continue;
      }
      out.push(ch);
      i++;
      continue;
    }

    throw new Error("Invalid char");
  }

  return out;
}

function toRPN(tokens) {
  const output = [];
  const stack = [];
  const p = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
  const right = { "^": true };

  for (const t of tokens) {
    if (!isNaN(t)) output.push(t);
    else if (isOp(t)) {
      while (
        stack.length &&
        isOp(stack[stack.length - 1]) &&
        ((right[t] && p[t] < p[stack[stack.length - 1]]) ||
          (!right[t] && p[t] <= p[stack[stack.length - 1]]))
      ) {
        output.push(stack.pop());
      }
      stack.push(t);
    } else if (t === "(") stack.push(t);
    else if (t === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") output.push(stack.pop());
      if (!stack.length) throw new Error("Mismatched parentheses");
      stack.pop();
    }
  }

  while (stack.length) {
    const top = stack.pop();
    if (top === "(" || top === ")") throw new Error("Mismatched parentheses");
    output.push(top);
  }

  return output;
}

function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (!isNaN(t)) {
      st.push(Number(t));
      continue;
    }
    if (isOp(t)) {
      if (st.length < 2) throw new Error("Invalid expression");
      const b = st.pop();
      const a = st.pop();

      let r;
      if (t === "+") r = a + b;
      if (t === "-") r = a - b;
      if (t === "*") r = a * b;
      if (t === "/") {
        if (b === 0) throw new Error("Division by zero");
        r = a / b;
      }
      if (t === "^") r = Math.pow(a, b);

      st.push(r);
    }
  }
  if (st.length !== 1 || !Number.isFinite(st[0])) throw new Error("Invalid result");
  return st[0];
}

function safeEvaluate(s) {
  const cleaned = sanitizeExpression(s);
  const tokens = tokenize(cleaned);
  return evalRPN(toRPN(tokens));
}
function tryEvaluate(s) {
  try { return safeEvaluate(s); } catch { return NaN; }
}
function evaluateExpression() {
  try {
    setExpression(String(safeEvaluate(expr)));
  } catch {
    setExpression("Error");
  }
}

// ---------- Scientific ----------
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

function applyScientific(fn) {
  if (expr === "Error") expr = "0";
  const n = tryEvaluate(expr);
  if (isNaN(n)) return setExpression("Error");

  switch (fn) {
    case "sin": return setExpression(String(Math.sin(toRad(n))));
    case "cos": return setExpression(String(Math.cos(toRad(n))));
    case "tan": return setExpression(String(Math.tan(toRad(n))));
    case "asin":
      if (n < -1 || n > 1) return setExpression("Error");
      return setExpression(String(toDeg(Math.asin(n))));
    case "acos":
      if (n < -1 || n > 1) return setExpression("Error");
      return setExpression(String(toDeg(Math.acos(n))));
    case "atan": return setExpression(String(toDeg(Math.atan(n))));
    case "log": return n > 0 ? setExpression(String(Math.log10(n))) : setExpression("Error");
    case "ln": return n > 0 ? setExpression(String(Math.log(n))) : setExpression("Error");
    case "sqrt": return n >= 0 ? setExpression(String(Math.sqrt(n))) : setExpression("Error");
    case "pow2": return setExpression(String(n * n));
    case "powY": return appendValue("^");
    case "factorial":
      if (!Number.isInteger(n) || n < 0 || n > 170) return setExpression("Error");
      return setExpression(String(factorial(n)));
    case "percent": return setExpression(String(n / 100));
    case "reciprocal":
      if (n === 0) return setExpression("Error");
      return setExpression(String(1 / n));
    case "exp": return setExpression(String(Math.exp(n)));
    case "abs": return setExpression(String(Math.abs(n)));
    case "negate": return setExpression(String(-n));
    case "pi":
      if (expr === "0") return setExpression(String(Math.PI));
      return appendValue(String(Math.PI));
    case "econst":
      if (expr === "0") return setExpression(String(Math.E));
      return appendValue(String(Math.E));
    case "ceil": return setExpression(String(Math.ceil(n)));
    case "floor": return setExpression(String(Math.floor(n)));
    case "cbrt": return setExpression(String(Math.cbrt(n)));
    case "log2": return n > 0 ? setExpression(String(Math.log2(n))) : setExpression("Error");
  }
}

// ---------- Events ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  pressFx(btn);

  if (btn.id === "scientificToggle") {
    app.classList.toggle("scientific-on");
    btn.setAttribute("aria-pressed", String(app.classList.contains("scientific-on")));
    return;
  }

  const action = btn.dataset.action;
  const value = btn.dataset.value;
  const fn = btn.dataset.fn;

  if (action === "clear") return clearAll();
  if (action === "backspace") return backspace();
  if (action === "equals") return evaluateExpression();
  if (fn) return applyScientific(fn);
  if (value) return appendValue(value);
});

// keyboard
document.addEventListener("keydown", (e) => {
  const k = e.key;

  const map = {
    Enter: '[data-action="equals"]',
    Escape: '[data-action="clear"]',
    Backspace: '[data-action="backspace"]'
  };
  if (map[k]) pressFx(document.querySelector(map[k]));

  if (/[0-9]/.test(k)) { pressFx(document.querySelector(`[data-value="${k}"]`)); return appendValue(k); }
  if (["+", "-", "*", "/"].includes(k)) { pressFx(document.querySelector(`[data-value="${k}"]`)); return appendValue(k); }
  if (k === ".") { pressFx(document.querySelector('[data-value="."]')); return appendValue("."); }
  if (k === "(" || k === ")") { pressFx(document.querySelector(`[data-value="${k}"]`)); return appendValue(k); }

  if (k === "Enter") {
    e.preventDefault();
    return evaluateExpression();
  }
  if (k === "Escape") return clearAll();
  if (k === "Backspace") return backspace();
});

updateDisplay();