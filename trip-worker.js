"use strict";

/*
  index.html と同じフォルダにある
  unix-crypt-td.min.js を直接読み込む
*/

try {

  importScripts("./unix-crypt-td.min.js");

} catch(e) {

  postMessage({
    type:"error",
    message:
      "unix-crypt-td.min.js の読み込みに失敗しました。"
  });

  throw e;

}


/*
  ライブラリ確認
*/

if(
  typeof self.unixCryptTD !== "function"
){

  postMessage({
    type:"error",
    message:
      "unixCryptTD unavailable"
  });

  throw new Error(
    "unixCryptTD unavailable"
  );

}


/*
  メインスレッドへ準備完了
*/

postMessage({
  type:"ready"
});


/* =========================================================
   定数
========================================================= */

const CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./";


let stopped = false;


/* =========================================================
   Trip
========================================================= */

function saltForTrip(key){

  let s =
    (key + "H.").slice(1,3);

  s =
    s.replace(
      /[^\x2e-\x7a]/g,
      "."
    );

  s =
    s.replace(
      /[\x3a-\x40\x5b-\x60]/g,
      c => {

        const table = {

          ":":"A",
          ";":"B",
          "<":"C",
          "=":"D",
          ">":"E",
          "?":"F",
          "@":"G",

          "[":"a",
          "\\":"b",
          "]":"c",
          "^":"d",
          "_":"e",
          "`":"f"

        };

        return table[c] || c;

      }
    );

  return s;

}


function makeTrip(key){

  if(
    typeof self.unixCryptTD !==
    "function"
  ){

    throw new Error(
      "unixCryptTD unavailable"
    );

  }

  return "◆" +
    self.unixCryptTD(
      key,
      saltForTrip(key)
    ).slice(-10);

}


/* =========================================================
   Index → Key
========================================================= */

function keyFromIndex(
  index,
  len
){

  let out = "";

  for(
    let i=0;
    i<len;
    i++
  ){

    out =
      CHARS[
        index % CHARS.length
      ] +
      out;

    index =
      Math.floor(
        index / CHARS.length
      );

  }

  return out;

}


/* =========================================================
   通常条件
========================================================= */

function normalMatch(
  trip,
  conditions
){

  const t =
    trip.slice(1);


  return conditions.every(
    c => {

      const n =
        c.text
          .trim()
          .replace(/^◆/,"");

      if(!n)
        return true;


      if(
        c.mode === "prefix"
      ){

        return t.startsWith(n);

      }


      if(
        c.mode === "suffix"
      ){

        return t.endsWith(n);

      }


      if(
        c.mode === "exact"
      ){

        return t === n;

      }


      return t.includes(n);

    }
  );

}


/* =========================================================
   Regex
========================================================= */

function regexMatch(
  trip,
  conditions
){

  const t =
    trip.slice(1);


  return conditions.every(
    c => {

      const regex =
        new RegExp(
          c.text
        );

      return regex.test(t);

    }
  );

}


/* =========================================================
   Mirror
========================================================= */

const mirrorMap = {

  ".":".",
  "0":"0",
  "8":"8",

  A:"A",
  H:"H",
  I:"I",
  M:"M",
  O:"O",
  T:"T",
  U:"U",
  V:"V",
  W:"W",
  X:"X",
  Y:"Y",

  b:"d",
  d:"b",

  i:"i",
  l:"l",
  o:"o",

  p:"q",
  q:"p",

  v:"v",
  w:"w"

};


function isMirror(t){

  for(
    let i=0;
    i<t.length;
    i++
  ){

    const a =
      mirrorMap[t[i]];

    const b =
      mirrorMap[
        t[t.length - 1 - i]
      ];

    if(!a || !b)
      return false;

    if(a !== b)
      return false;

  }

  return true;

}


/* =========================================================
   特殊Trip
========================================================= */

function specialMatch(
  trip,
  type
){

  if(!type)
    return true;


  const t =
    trip.slice(1);


  /* 純n連 */

  if(type === "pure"){

    let run = 1;

    for(
      let i=1;
      i<t.length;
      i++
    ){

      if(
        t[i] ===
        t[i-1]
      ){

        run++;

        if(run >= 8)
          return true;

      }else{

        run = 1;

      }

    }

    return false;

  }


  /* 準n連 */

  if(type === "semi"){

    let run = 1;

    for(
      let i=1;
      i<t.length;
      i++
    ){

      if(
        t[i].toLowerCase() ===
        t[i-1].toLowerCase()
      ){

        run++;

        if(run >= 9)
          return true;

      }else{

        run = 1;

      }

    }

    return false;

  }


  /* 二構 */

  if(type === "two"){

    return new Set(t).size === 2;

  }


  /* 最長 */

  if(type === "longest"){

    return /^[MmW]+$/.test(t);

  }


  /* 最短 */

  if(type === "shortest"){

    return /^[li.]+$/.test(t);

  }


  /* 八雲 */

  if(type === "yakumo"){

    /*
      3文字 × 3組
      10文字なら最後は自由
    */

    if(t.length < 9)
      return false;

    for(
      let i=0;
      i<9;
      i+=3
    ){

      if(
        t[i] !==
        t[i+1] ||
        t[i] !==
        t[i+2]
      ){

        return false;

      }

    }

    return true;

  }


  /* 鏡 */

  if(type === "mirror"){

    return isMirror(t);

  }


  /* 回文 */

  if(type === "palindrome"){

    for(
      let i=0;
      i<t.length/2;
      i++
    ){

      if(
        t[i] !==
        t[t.length-1-i]
      ){

        return false;

      }

    }

    return true;

  }


  /* 山彦 */

  if(type === "echo"){

    if(
      t.length % 2 !== 0
    )
      return false;

    const half =
      t.length / 2;

    return (
      t.slice(0,half) ===
      t.slice(half)
    );

  }


  /* 双連 */

  if(type === "double"){

    for(
      let i=0;
      i<t.length;
      i+=2
    ){

      if(
        t[i] !==
        t[i+1]
      ){

        return false;

      }

    }

    return true;

  }


  /* 全数 */

  if(type === "number"){

    return /^[0-9]+$/.test(t);

  }


  /* 飛石 */

  if(type === "stepping"){

    for(
      let i=1;
      i<t.length;
      i+=2
    ){

      if(
        t[i] !== "." &&
        t[i] !== "/"
      ){

        return false;

      }

    }

    return true;

  }


  /* 拡飛 */

  if(
    type ===
    "expandedStepping"
  ){

    const separator =
      t[1];

    if(
      separator !== "." &&
      separator !== "/"
    ){

      return false;

    }

    for(
      let i=1;
      i<t.length;
      i+=2
    ){

      if(
        t[i] !== separator
      ){

        return false;

      }

    }

    return true;

  }


  return false;

}


/* =========================================================
   メッセージ
========================================================= */

self.onmessage = event => {

  const data =
    event.data;


  if(data.cmd === "stop"){

    stopped = true;

    return;

  }


  if(data.cmd !== "start")
    return;


  stopped = false;


  const {
    workerIndex,
    workerCount,
    keyLength,
    conditions,
    searchType,
    special
  } = data;


  let attempts = 0;
  let found = 0;

  const started =
    performance.now();


  /*
    Workerごとに
    0,1,2,3...
    と分割する。

    これで同じキーを
    複数Workerが調べることを防ぐ。
  */

  let index =
    workerIndex;


  /*
    無限検索。

    Stopされるまで続行。
  */

  while(!stopped){

    const key =
      keyFromIndex(
        index,
        keyLength
      );


    let trip;

    try{

      trip =
        makeTrip(key);

    }catch(e){

      postMessage({

        type:"error",

        message:e.message

      });

      return;

    }


    attempts++;


    let matched = true;


    /*
      通常 / Regex
    */

    if(
      searchType ===
      "regex"
    ){

      matched =
        regexMatch(
          trip,
          conditions
        );

    }else{

      matched =
        normalMatch(
          trip,
          conditions
        );

    }


    /*
      特殊Trip
    */

    if(
      matched &&
      special
    ){

      matched =
        specialMatch(
          trip,
          special
        );

    }


    if(matched){

      found++;

      postMessage({

        type:"hit",

        key,

        trip

      });

    }


    /*
      1000件ごとに進捗
    */

    if(
      attempts % 1000 === 0
    ){

      const elapsed =
        Math.max(
          0.001,
          (
            performance.now() -
            started
          ) / 1000
        );


      const rate =
        Math.round(
          attempts /
          elapsed
        );


      postMessage({

        type:"progress",

        attempts,

        rate,

        found

      });

    }


    /*
      次のWorker担当番号へ
    */

    index +=
      workerCount;

  }


  const elapsed =
    Math.max(
      0.001,
      (
        performance.now() -
        started
      ) / 1000
    );


  postMessage({

    type:"done",

    attempts,

    rate:
      Math.round(
        attempts /
        elapsed
      ),

    found

  });

};