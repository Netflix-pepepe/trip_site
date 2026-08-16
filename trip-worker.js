"use strict";

/*
============================================================
  トリップ検索 Worker
============================================================
*/

importScripts("./unix-crypt-td.min.js");


/* =========================================================
   文字セット
========================================================= */

const CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./";


/* =========================================================
   停止
========================================================= */

let stopped = false;


/* =========================================================
   salt
========================================================= */

function saltForTrip(key){

  let s =
    (key + "H.").slice(1,3);

  s =
    s.replace(/[^\x2e-\x7a]/g,".");

  s =
    s.replace(
      /[:;<=>?@[\\\]^_`]/g,
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


/* =========================================================
   トリップ生成
========================================================= */

function makeTrip(key){

  if(
    typeof unixCryptTD !==
    "function"
  ){

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


/* =========================================================
   インデックス → キー
========================================================= */

function keyFromIndex(
  index,
  len
){

  let out = "";

  for(
    let i = 0;
    i < len;
    i++
  ){

    out =
      CHARS[
        index %
        CHARS.length
      ] +
      out;

    index =
      Math.floor(
        index /
        CHARS.length
      );
  }

  return out;
}


/* =========================================================
   純n連
========================================================= */

function pureN(
  trip,
  n
){

  const t =
    trip.slice(1);

  for(
    let i = 0;
    i <= t.length - n;
    i++
  ){

    let ok = true;

    for(
      let j = 1;
      j < n;
      j++
    ){

      if(
        t[i] !== t[i+j]
      ){

        ok = false;
        break;
      }
    }

    if(ok){
      return true;
    }
  }

  return false;
}


/* =========================================================
   準n連
========================================================= */

function semiN(
  trip,
  n
){

  const t =
    trip
      .slice(1)
      .toLowerCase();

  for(
    let i = 0;
    i <= t.length - n;
    i++
  ){

    let ok = true;

    for(
      let j = 1;
      j < n;
      j++
    ){

      if(
        t[i] !== t[i+j]
      ){

        ok = false;
        break;
      }
    }

    if(ok){
      return true;
    }
  }

  return false;
}


/* =========================================================
   二構
========================================================= */

function isDouble(
  trip
){

  const t =
    trip.slice(1);

  return new Set(t).size <= 2;
}


/* =========================================================
   最長
========================================================= */

function isLongest(
  trip
){

  return /^[MmW]+$/.test(
    trip.slice(1)
  );
}


/* =========================================================
   最短
========================================================= */

function isShortest(
  trip
){

  return /^[li.]+$/.test(
    trip.slice(1)
  );
}


/* =========================================================
   八雲
========================================================= */

function isYakumo(
  trip
){

  const t =
    trip.slice(1);

  /*
   * 10桁:
   *
   * aaa ttt www x
   *
   * 最後の1文字は自由
   */

  if(t.length !== 10){
    return false;
  }

  for(
    let i = 0;
    i < 9;
    i += 3
  ){

    if(
      t[i] !== t[i+1] ||
      t[i] !== t[i+2]
    ){

      return false;
    }
  }

  return true;
}


/* =========================================================
   鏡
========================================================= */

/*
   鏡で対になる文字。

   例:

   o ↔ o
   8 ↔ 8
   A ↔ A
   l ↔ l
   b ↔ d
   p ↔ q
   M ↔ W
   etc.

   必要に応じて追加可能。
*/

const MIRROR = {

  ".":".",

  "0":"0",
  "8":"8",

  "A":"A",
  "H":"H",
  "I":"I",
  "M":"M",
  "O":"O",
  "T":"T",
  "U":"U",
  "V":"V",
  "W":"M",
  "X":"X",
  "Y":"Y",

  "b":"d",
  "d":"b",

  "i":"i",
  "l":"l",

  "o":"o",

  "p":"q",
  "q":"p",

  "v":"v",
  "w":"w",

  "a":"a"
};


function isMirror(
  trip
){

  const t =
    trip.slice(1);

  for(
    let i = 0;
    i < Math.floor(t.length / 2);
    i++
  ){

    const left =
      t[i];

    const right =
      t[
        t.length -
        1 -
        i
      ];

    if(
      MIRROR[left] !==
      right
    ){

      return false;
    }
  }

  return true;
}


/* =========================================================
   回文
========================================================= */

function isPalindrome(
  trip
){

  const t =
    trip.slice(1);

  for(
    let i = 0;
    i < Math.floor(t.length / 2);
    i++
  ){

    if(
      t[i] !==
      t[
        t.length -
        1 -
        i
      ]
    ){

      return false;
    }
  }

  return true;
}


/* =========================================================
   山彦
========================================================= */

function isEcho(
  trip
){

  const t =
    trip.slice(1);

  if(
    t.length % 2 !== 0
  ){

    return false;
  }

  const half =
    t.length / 2;

  return (
    t.slice(0,half) ===
    t.slice(half)
  );
}


/* =========================================================
   双連
========================================================= */

function isDoublePair(
  trip
){

  const t =
    trip.slice(1);

  if(
    t.length % 2 !== 0
  ){

    return false;
  }

  for(
    let i = 0;
    i < t.length;
    i += 2
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


/* =========================================================
   全数
========================================================= */

function isNumbers(
  trip
){

  return /^[0-9]+$/.test(
    trip.slice(1)
  );
}


/* =========================================================
   飛石
========================================================= */

function isStepping(
  trip
){

  const t =
    trip.slice(1);

  /*
   * 例:
   *
   * Z.y.O.6.0.
   *
   * 奇数位置が . または /
   */

  for(
    let i = 1;
    i < t.length;
    i += 2
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


/* =========================================================
   拡飛
========================================================= */

function isExpandStepping(
  trip
){

  const t =
    trip.slice(1);

  if(
    t.length < 2
  ){

    return false;
  }

  /*
   * 奇数位置が同じ文字
   */

  const separator =
    t[1];

  for(
    let i = 1;
    i < t.length;
    i += 2
  ){

    if(
      t[i] !== separator
    ){

      return false;
    }
  }

  return true;
}


/* =========================================================
   特殊判定
========================================================= */

function specialMatch(
  trip,
  type
){

  switch(type){

    case "pure8":
      return pureN(trip,8);

    case "pure9":
      return pureN(trip,9);

    case "pure10":
      return pureN(trip,10);

    case "semi9":
      return semiN(trip,9);

    case "semi10":
      return semiN(trip,10);

    case "double":
      return isDouble(trip);

    case "longest":
      return isLongest(trip);

    case "shortest":
      return isShortest(trip);

    case "yakumo":
      return isYakumo(trip);

    case "mirror":
      return isMirror(trip);

    case "palindrome":
      return isPalindrome(trip);

    case "echo":
      return isEcho(trip);

    case "doublePair":
      return isDoublePair(trip);

    case "numbers":
      return isNumbers(trip);

    case "stepping":
      return isStepping(trip);

    case "expandStepping":
      return isExpandStepping(trip);

    default:
      return false;
  }
}


/* =========================================================
   正規表現
========================================================= */

function regexMatch(
  trip,
  pattern
){

  try{

    const re =
      new RegExp(pattern);

    return re.test(
      trip.slice(1)
    );

  }catch{

    return false;
  }
}


/* =========================================================
   全条件判定
========================================================= */

function matches(
  trip,
  needles
){

  const t =
    trip.slice(1);

  return needles.every(
    n => {

      if(!n.text){
        return true;
      }


      /* 通常 */

      if(
        n.mode ===
        "contains"
      ){

        return t.includes(
          n.text.replace(
            /^◆/,
            ""
          )
        );
      }


      /* 前方 */

      if(
        n.mode ===
        "prefix"
      ){

        return t.startsWith(
          n.text.replace(
            /^◆/,
            ""
          )
        );
      }


      /* 後方 */

      if(
        n.mode ===
        "suffix"
      ){

        return t.endsWith(
          n.text.replace(
            /^◆/,
            ""
          )
        );
      }


      /* 正規表現 */

      if(
        n.mode ===
        "regex"
      ){

        return regexMatch(
          trip,
          n.text
        );
      }


      /* 特殊 */

      if(
        n.mode ===
        "special"
      ){

        return specialMatch(
          trip,
          n.text
        );
      }


      return true;
    }
  );
}


/* =========================================================
   Workerメッセージ
========================================================= */

self.onmessage =
  event => {

    const data =
      event.data;


    /* =========================
       停止
    ========================== */

    if(
      data.cmd === "stop"
    ){

      stopped = true;

      return;
    }


    /* =========================
       開始
    ========================== */

    if(
      data.cmd !== "start"
    ){

      return;
    }


    stopped = false;


    const tripLen =
      Number(
        data.tripLen
      );


    const maxAttempts =
      data.maxAttempts;


    const needles =
      Array.isArray(
        data.needles
      )
        ? data.needles
        : [];


    let index = 0;

    let attempts = 0;

    let found = 0;


    const started =
      performance.now();


    const total =
      Math.pow(
        CHARS.length,
        tripLen
      );


    const unlimited =
      maxAttempts === null ||
      maxAttempts === undefined ||
      maxAttempts === "";


    const limit =
      unlimited
        ? total
        : Math.min(
            total,
            Number(maxAttempts)
          );


    /*
     * 一度に処理する数
     */

    const BATCH =
      500;


    /* =========================
       バッチ
    ========================== */

    function runBatch(){

      if(stopped){

        finish(true);

        return;
      }


      const end =
        Math.min(
          index + BATCH,
          limit
        );


      while(
        index < end &&
        !stopped
      ){

        const key =
          keyFromIndex(
            index,
            tripLen
          );


        let trip;

        try{

          trip =
            makeTrip(key);

        }catch(error){

          postMessage({

            type:"error",

            message:
              error.message ||
              String(error)

          });

          return;
        }


        attempts++;


        if(
          matches(
            trip,
            needles
          )
        ){

          found++;


          postMessage({

            type:"hit",

            item:{
              key,
              trip
            }

          });
        }


        index++;
      }


      const seconds =
        (
          performance.now() -
          started
        ) / 1000;


      const rate =
        Math.round(
          attempts /
          Math.max(
            seconds,
            0.001
          )
        );


      postMessage({

        type:"progress",

        attempts,

        rate,

        found,

        total

      });


      /*
       * 次のバッチ
       */

      if(
        !stopped &&
        index < limit
      ){

        setTimeout(
          runBatch,
          0
        );

      }else{

        finish(
          stopped
        );
      }
    }


    /* =========================
       完了
    ========================== */

    function finish(
      wasStopped
    ){

      const seconds =
        (
          performance.now() -
          started
        ) / 1000;


      const rate =
        Math.round(
          attempts /
          Math.max(
            seconds,
            0.001
          )
        );


      postMessage({

        type:"done",

        attempts,

        rate,

        found,

        stopped:
          wasStopped

      });
    }


    runBatch();
  };
