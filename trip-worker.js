/* trip-worker.js */

importScripts("./unix-crypt-td.min.js");

if (typeof unixCryptTD !== "function") {
  postMessage({
    type: "error",
    message: "unixCryptTD unavailable"
  });
  throw new Error("unixCryptTD unavailable");
}

const CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./";

let stopped = false;

function saltForTrip(key) {
  let s = (key + "H.").slice(1, 3);

  s = s.replace(/[^\.-z]/g, ".");

  s = s.replace(/[\:;<=>?@[\\\]^_`]/g, c => {
    const table = {
      ":": "A",
      ";": "B",
      "<": "C",
      "=": "D",
      ">": "E",
      "?": "F",
      "@": "G",
      "[": "a",
      "\\": "b",
      "]": "c",
      "^": "d",
      "_": "e",
      "`": "f"
    };

    return table[c] || c;
  });

  return s;
}

function makeTrip(key, length) {
  const crypt = unixCryptTD(
    key,
    saltForTrip(key)
  );

  return "◆" + crypt.slice(-length);
}

function keyFromIndex(index, chars, len) {
  let out = "";

  for (let i = 0; i < len; i++) {
    out = chars[index % chars.length] + out;
    index = Math.floor(index / chars.length);
  }

  return out;
}

/* =========================
   特殊トリップ判定
========================= */

function isPureN(trip, min = 8) {
  const t = trip.replace(/^◆/, "");

  let longest = 1;
  let current = 1;

  for (let i = 1; i < t.length; i++) {
    if (t[i] === t[i - 1]) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest >= min;
}

function isJunN(trip, min = 9) {
  const t = trip.replace(/^◆/, "").toLowerCase();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < t.length; i++) {
    if (t[i] === t[i - 1]) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest >= min;
}

function isNiko(trip) {
  const t = trip.replace(/^◆/, "");
  return new Set(t).size === 2;
}

function isSaicho(trip) {
  return /^[MmW]+$/.test(trip.replace(/^◆/, ""));
}

function isSaitan(trip) {
  return /^[li.]+$/.test(trip.replace(/^◆/, ""));
}

function isYakumo(trip) {
  const t = trip.replace(/^◆/, "");

  if (t.length < 9) return false;

  /*
   * 3文字ずつ同じ文字
   * 例 aaa ttt www + 残り1文字
   */

  for (let i = 0; i + 2 < t.length; i += 3) {
    if (
      t[i] !== t[i + 1] ||
      t[i] !== t[i + 2]
    ) {
      return false;
    }
  }

  return true;
}

const MIRROR_MAP = {
  ".": ".",
  "0": "0",
  "8": "8",
  "A": "A",
  "H": "H",
  "I": "I",
  "M": "M",
  "O": "O",
  "T": "T",
  "U": "U",
  "V": "V",
  "W": "W",
  "X": "X",
  "Y": "Y",
  "b": "d",
  "d": "b",
  "i": "i",
  "l": "l",
  "o": "o",
  "p": "q",
  "q": "p",
  "v": "v",
  "w": "w",
  "x": "x"
};

function isKagami(trip) {
  const t = trip.replace(/^◆/, "");

  for (let i = 0; i < t.length; i++) {
    const mirrored = MIRROR_MAP[t[i]];

    if (!mirrored) return false;

    if (mirrored !== t[t.length - 1 - i]) {
      return false;
    }
  }

  return true;
}

function isPalindrome(trip) {
  const t = trip.replace(/^◆/, "");

  for (let i = 0; i < Math.floor(t.length / 2); i++) {
    if (t[i] !== t[t.length - 1 - i]) {
      return false;
    }
  }

  return true;
}

function isYamabiko(trip) {
  const t = trip.replace(/^◆/, "");

  if (t.length % 2 !== 0) return false;

  const half = t.length / 2;

  return t.slice(0, half) === t.slice(half);
}

function isSoren(trip) {
  const t = trip.replace(/^◆/, "");

  for (let i = 0; i < t.length; i += 2) {
    if (t[i] !== t[i + 1]) {
      return false;
    }
  }

  return true;
}

function isZensu(trip) {
  return /^[0-9]+$/.test(
    trip.replace(/^◆/, "")
  );
}

function isTobiishi(trip) {
  const t = trip.replace(/^◆/, "");

  for (let i = 1; i < t.length; i += 2) {
    if (t[i] !== "." && t[i] !== "/") {
      return false;
    }
  }

  return true;
}

function isKakuTobi(trip) {
  const t = trip.replace(/^◆/, "");

  if (t.length < 2) return false;

  const separator = t[1];

  if (separator !== "." && separator !== "/") {
    return false;
  }

  for (let i = 1; i < t.length; i += 2) {
    if (t[i] !== separator) {
      return false;
    }
  }

  return true;
}

function specialMatch(trip, special) {
  switch (special) {
    case "pure":
      return isPureN(trip, 8);

    case "jun":
      return isJunN(trip, 9);

    case "niko":
      return isNiko(trip);

    case "saicho":
      return isSaicho(trip);

    case "saitan":
      return isSaitan(trip);

    case "yakumo":
      return isYakumo(trip);

    case "kagami":
      return isKagami(trip);

    case "palindrome":
      return isPalindrome(trip);

    case "yamabiko":
      return isYamabiko(trip);

    case "soren":
      return isSoren(trip);

    case "zensu":
      return isZensu(trip);

    case "tobiishi":
      return isTobiishi(trip);

    case "kakutobi":
      return isKakuTobi(trip);

    default:
      return true;
  }
}

/* =========================
   通常条件
========================= */

function normalMatch(trip, conditions) {
  const t = trip.replace(/^◆/, "");

  return conditions.every(c => {
    if (!c.text) return true;

    if (c.regex) {
      try {
        const flags = c.ignoreCase ? "i" : "";

        return new RegExp(c.text, flags).test(t);
      } catch {
        return false;
      }
    }

    const n = c.text.replace(/^◆/, "");

    switch (c.mode) {
      case "prefix":
        return t.startsWith(n);

      case "suffix":
        return t.endsWith(n);

      case "exact":
        return t === n;

      default:
        return t.includes(n);
    }
  });
}

/* =========================
   検索
========================= */

onmessage = e => {
  const data = e.data;

  if (data.cmd === "stop") {
    stopped = true;
    return;
  }

  if (data.cmd !== "start") {
    return;
  }

  stopped = false;

  const {
    workerId,
    workerCount,
    tripLen,
    maxAttempts,
    unlimited,
    conditions,
    special
  } = data;

  let attempts = 0;
  let found = 0;

  const started = performance.now();

  /*
   * Workerごとに担当するindexを分散
   *
   * Worker 0:
   * 0, 4, 8, 12...
   *
   * Worker 1:
   * 1, 5, 9, 13...
   */

  let index = workerId;

  const total =
    Math.pow(CHARS.length, tripLen);

  while (
    !stopped &&
    (unlimited || attempts < maxAttempts) &&
    index < total
  ) {
    const key =
      keyFromIndex(
        index,
        CHARS,
        tripLen
      );

    let trip;

    try {
      trip = makeTrip(
        key,
        tripLen
      );
    } catch (err) {
      postMessage({
        type: "error",
        message: err.message
      });

      return;
    }

    attempts++;

    let ok = true;

    if (!normalMatch(trip, conditions)) {
      ok = false;
    }

    if (
      ok &&
      special &&
      special !== "none"
    ) {
      ok = specialMatch(
        trip,
        special
      );
    }

    if (ok) {
      found++;

      postMessage({
        type: "hit",
        workerId,
        item: {
          key,
          trip
        }
      });
    }

    if (attempts % 5000 === 0) {
      const sec =
        (performance.now() - started) / 1000;

      postMessage({
        type: "progress",
        workerId,
        attempts,
        found,
        rate: Math.round(
          attempts /
          Math.max(sec, 0.001)
        )
      });
    }

    index += workerCount;
  }

  const sec =
    (performance.now() - started) / 1000;

  postMessage({
    type: "done",
    workerId,
    attempts,
    found,
    rate: Math.round(
      attempts /
      Math.max(sec, 0.001)
    ),
    stopped
  });
};
