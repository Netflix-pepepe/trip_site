"use strict";

/*
  trip-worker.js

  index.html
  trip-worker.js
  unix-crypt-td.min.js

  この3つを同じフォルダに置く。
*/


/* ========================================
   unix-crypt-td.min.js を読み込む
======================================== */

try {

  const libUrl = new URL(
    "./unix-crypt-td.min.js",
    self.location.href
  ).href;

  console.log("Loading:", libUrl);

  importScripts(libUrl);

} catch (e) {

  postMessage({
    type: "error",
    message:
      "unix-crypt-td.min.js の読み込み失敗: " +
      e.message
  });

}


/* ========================================
   ライブラリ確認
======================================== */

if (typeof unixCryptTD !== "function") {

  postMessage({
    type: "error",
    message:
      "unixCryptTD unavailable。" +
      "unix-crypt-td.min.js が正しく読み込まれていません。"
  });

} else {

  postMessage({
    type: "ready"
  });

}


/* ========================================
   停止フラグ
======================================== */

let stopped = false;


/* ========================================
   salt
======================================== */

function saltForTrip(key) {

  let s = (key + "H.").slice(1, 3);

  s = s.replace(/[^\.-z]/g, ".");

  s = s.replace(
    /[\:;<=>?@[\\\]^_`]/g,
    function(c) {

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
    }
  );

  return s;
}


/* ========================================
   トリップ生成
======================================== */

function makeTrip(key) {

  if (typeof unixCryptTD !== "function") {
    throw new Error(
      "unixCryptTD unavailable"
    );
  }

  return "◆" +
    unixCryptTD(
      key,
      saltForTrip(key)
    ).slice(-10);
}


/* ========================================
   文字
======================================== */

const CHARS =
  "abcdefghijklmnopqrstuvwxyz" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "0123456789./";


/* ========================================
   インデックス → キー
======================================== */

function keyFromIndex(index, len) {

  let out = "";

  for (let i = 0; i < len; i++) {

    out =
      CHARS[index % CHARS.length] +
      out;

    index =
      Math.floor(index / CHARS.length);
  }

  return out;
}


/* ========================================
   通常条件
======================================== */

function normalMatches(trip, needles) {

  const t = trip.slice(1);

  return needles.every(function(n) {

    if (n.mode === "prefix") {
      return t.startsWith(n.text);
    }

    if (n.mode === "suffix") {
      return t.endsWith(n.text);
    }

    if (n.mode === "exact") {
      return t === n.text;
    }

    return t.includes(n.text);
  });
}


/* ========================================
   正規表現
======================================== */

function regexMatches(trip, needles) {

  const t = trip.slice(1);

  return needles.every(function(n) {

    try {

      return new RegExp(n.text).test(t);

    } catch (e) {

      return false;

    }

  });
}


/* ========================================
   純n連
======================================== */

function pureN(t) {

  for (let i = 0; i < t.length; i++) {

    let count = 1;

    for (
      let j = i + 1;
      j < t.length && t[j] === t[i];
      j++
    ) {

      count++;

    }

    if (count >= 8) {
      return true;
    }
  }

  return false;
}


/* ========================================
   準n連
======================================== */

function semiN(t) {

  for (let i = 0; i < t.length; i++) {

    let count = 1;

    const c =
      t[i].toLowerCase();

    for (
      let j = i + 1;
      j < t.length &&
      t[j].toLowerCase() === c;
      j++
    ) {

      count++;

    }

    if (count >= 9) {
      return true;
    }
  }

  return false;
}


/* ========================================
   二構
======================================== */

function twoStructure(t) {

  return new Set(t).size === 2;
}


/* ========================================
   最長
======================================== */

function longest(t) {

  return /^[MmW]+$/.test(t);
}


/* ========================================
   最短
======================================== */

function shortest(t) {

  return /^[li.]+$/.test(t);
}


/* ========================================
   八雲
======================================== */

function yakumo(t) {

  if (t.length !== 10) {
    return false;
  }

  for (let i = 0; i < 9; i += 3) {

    if (
      t[i] !== t[i + 1] ||
      t[i] !== t[i + 2]
    ) {

      return false;

    }
  }

  return true;
}


/* ========================================
   鏡
======================================== */

function mirror(t) {

  const map = {

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

  for (let i = 0; i < t.length; i++) {

    const a = t[i];

    const b =
      t[t.length - 1 - i];

    if (map[a] !== b) {
      return false;
    }
  }

  return true;
}


/* ========================================
   回文
======================================== */

function palindrome(t) {

  for (
    let i = 0;
    i < t.length / 2;
    i++
  ) {

    if (
      t[i] !==
      t[t.length - 1 - i]
    ) {

      return false;

    }
  }

  return true;
}


/* ========================================
   山彦
======================================== */

function echo(t) {

  if (t.length % 2 !== 0) {
    return false;
  }

  const half =
    t.length / 2;

  return (
    t.slice(0, half) ===
    t.slice(half)
  );
}


/* ========================================
   双連
======================================== */

function doublePair(t) {

  if (t.length % 2 !== 0) {
    return false;
  }

  for (
    let i = 0;
    i < t.length;
    i += 2
  ) {

    if (t[i] !== t[i + 1]) {
      return false;
    }
  }

  return true;
}


/* ========================================
   全数
======================================== */

function numberOnly(t) {

  return /^[0-9]+$/.test(t);
}


/* ========================================
   飛石
======================================== */

function stepping(t) {

  for (let i = 0; i < t.length; i++) {

    if (i % 2 === 0) {

      if (!/[\/.]/.test(t[i])) {
        return false;
      }

    } else {

      if (/[\/.]/.test(t[i])) {
        return false;
      }

    }
  }

  return true;
}


/* ========================================
   拡飛
======================================== */

function wideStepping(t) {

  if (t.length < 3) {
    return false;
  }

  /*
    例:

    oUlUEUDUDU

    のように、
    1文字ごとに同じ区切り文字が
    入るタイプを判定。
  */

  const separator = t[1];

  for (
    let i = 1;
    i < t.length;
    i += 2
  ) {

    if (t[i] !== separator) {
      return false;
    }
  }

  return true;
}


/* ========================================
   特殊判定
======================================== */

function specialMatches(trip, type) {

  if (!type) {
    return true;
  }

  const t = trip.slice(1);

  switch (type) {

    case "pure":
      return pureN(t);

    case "semi":
      return semiN(t);

    case "two":
      return twoStructure(t);

    case "long":
      return longest(t);

    case "short":
      return shortest(t);

    case "yakumo":
      return yakumo(t);

    case "mirror":
      return mirror(t);

    case "palindrome":
      return palindrome(t);

    case "echo":
      return echo(t);

    case "double":
      return doublePair(t);

    case "number":
      return numberOnly(t);

    case "stepping":
      return stepping(t);

    case "wideStepping":
      return wideStepping(t);

    default:
      return true;
  }
}


/* ========================================
   Worker
======================================== */

self.onmessage = function(e) {

  const data = e.data;

  if (data.cmd === "stop") {

    stopped = true;

    return;
  }


  if (data.cmd !== "start") {
    return;
  }


  if (typeof unixCryptTD !== "function") {

    postMessage({

      type: "error",

      message:
        "unixCryptTD unavailable"

    });

    return;
  }


  stopped = false;


  const tripLen =
    Number(data.tripLen);

  const needles =
    data.needles || [];

  const searchMode =
    data.searchMode || "normal";

  const special =
    data.special || "";


  let attempts = 0;

  let found = 0;

  let index = 0;


  const started =
    performance.now();


  /*
    最大試行回数なし。
    条件にヒットするか、
    停止するまで続ける。
  */

  const total =
    Math.pow(
      CHARS.length,
      tripLen
    );


  const BATCH = 1000;


  while (
    index < total &&
    !stopped
  ) {

    for (
      let i = 0;
      i < BATCH &&
      index < total &&
      !stopped;
      i++
    ) {

      const key =
        keyFromIndex(
          index,
          tripLen
        );


      const trip =
        makeTrip(key);


      attempts++;


      let matched;


      if (searchMode === "regex") {

        matched =
          regexMatches(
            trip,
            needles
          );

      } else {

        matched =
          normalMatches(
            trip,
            needles
          );
      }


      if (
        matched &&
        specialMatches(
          trip,
          special
        )
      ) {

        found++;


        postMessage({

          type: "hit",

          item: {
            key: key,
            trip: trip
          }

        });
      }


      index++;

    }


    if (
      attempts % 1000 === 0
    ) {

      const sec =
        (performance.now() - started) / 1000;


      postMessage({

        type: "progress",

        attempts: attempts,

        rate:
          Math.round(
            attempts /
            Math.max(sec, 0.001)
          ),

        found: found

      });

    }
  }


  const sec =
    (performance.now() - started) / 1000;


  postMessage({

    type: "done",

    attempts: attempts,

    rate:
      Math.round(
        attempts /
        Math.max(sec, 0.001)
      ),

    found: found,

    stopped: stopped

  });

};
