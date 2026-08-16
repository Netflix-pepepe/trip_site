"use strict";


/*
============================================================
  IMPORTANT

  CDNは使わない。

  GitHub Pages上の

  ./unix-crypt-td.min.js

  をWorkerから直接読み込む。
============================================================
*/

importScripts("./unix-crypt-td.min.js");


/* ==========================================================
   初期確認
========================================================== */

if(typeof unixCryptTD !== "function"){

  postMessage({

    type:"error",

    message:
      "unixCryptTD unavailable。"+
      "unix-crypt-td.min.js が同じフォルダにあるか確認してください。"

  });

}else{

  postMessage({
    type:"ready"
  });

}


/* ==========================================================
   Trip生成
========================================================== */

function saltForTrip(key){

  let s=
    (key+"H.")
    .slice(1,3);

  s=
    s.replace(/[^\x2e-\x7a]/g,".");

  s=
    s.replace(
      /[\x3a-\x40\x5b-\x60]/g,
      function(c){

        const table={

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
    typeof unixCryptTD !== "function"
  ){

    throw new Error(
      "unixCryptTD unavailable"
    );

  }

  return "◆"+
    unixCryptTD(
      key,
      saltForTrip(key)
    ).slice(-10);

}


/* ==========================================================
   キー文字
========================================================== */

const CHARS=
  "abcdefghijklmnopqrstuvwxyz"+
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ"+
  "0123456789./";


/* ==========================================================
   順番探索用
========================================================== */

function keyFromIndex(
  index,
  len
){

  let out="";

  for(
    let i=0;
    i<len;
    i++
  ){

    out=
      CHARS[
        index % CHARS.length
      ]+
      out;

    index=
      Math.floor(
        index/CHARS.length
      );

  }

  return out;

}


/* ==========================================================
   ランダムキー
========================================================== */

function randomKey(len){

  let out="";

  for(
    let i=0;
    i<len;
    i++
  ){

    out+=
      CHARS[
        Math.floor(
          Math.random()*CHARS.length
        )
      ];

  }

  return out;

}


/* ==========================================================
   条件判定
========================================================== */

function basicMatches(
  trip,
  needles
){

  const t=
    trip.replace(/^◆/,"");

  return needles.every(
    function(n){

      const text=
        String(n.text)
        .replace(/^◆/,"");

      if(
        n.mode==="prefix"
      ){

        return t.startsWith(text);

      }

      if(
        n.mode==="suffix"
      ){

        return t.endsWith(text);

      }

      return t.includes(text);

    }
  );

}


/* ==========================================================
   正規表現
========================================================== */

function regexMatches(
  trip,
  regex
){

  if(!regex){
    return true;
  }

  try{

    return new RegExp(
      regex
    ).test(
      trip.replace(/^◆/,"")
    );

  }catch(e){

    return false;

  }

}


/* ==========================================================
   純n連

   同じ文字がn回以上連続
========================================================== */

function pureN(
  t,
  n
){

  for(
    let i=0;
    i<=t.length-n;
    i++
  ){

    let good=true;

    for(
      let j=1;
      j<n;
      j++
    ){

      if(
        t[i]!==t[i+j]
      ){

        good=false;
        break;

      }

    }

    if(good){
      return true;
    }

  }

  return false;

}


/* ==========================================================
   準n連

   大文字小文字を無視
========================================================== */

function junN(
  t,
  n
){

  const s=
    t.toLowerCase();

  return pureN(
    s,
    n
  );

}


/* ==========================================================
   二構

   2種類以下
========================================================== */

function doubleType(t){

  return new Set(t).size===2;

}


/* ==========================================================
   最長

   [MmW]
========================================================== */

function saicho(t){

  return /^[MmW]+$/.test(t);

}


/* ==========================================================
   最短

   [li.]
========================================================== */

function saitan(t){

  return /^[li.]+$/.test(t);

}


/* ==========================================================
   八雲

   3文字ずつ同じ文字

   10桁:
   AAA BBB CCC X

   12桁:
   AAA BBB CCC DDD
========================================================== */

function yakumo(t){

  let count=0;

  for(
    let i=0;
    i+2<t.length;
    i+=3
  ){

    if(
      t[i]===t[i+1] &&
      t[i]===t[i+2]
    ){

      count++;

    }else{

      return false;

    }

  }

  return count>=3;

}


/* ==========================================================
   回文
========================================================== */

function palindrome(t){

  for(
    let i=0;
    i<t.length/2;
    i++
  ){

    if(
      t[i]!==t[t.length-1-i]
    ){

      return false;

    }

  }

  return true;

}


/* ==========================================================
   鏡

   文字そのものではなく、
   左右反転して同じに見える文字を対応させる。

   対応は一般的な鏡文字を採用。
========================================================== */

const MIRROR_MAP={

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
  "W":"W",
  "X":"X",
  "Y":"Y",

  "b":"d",
  "d":"b",

  "p":"q",
  "q":"p",

  "l":"l",
  "i":"i",

  "o":"o",
  "v":"v",
  "w":"w"
};


function mirror(t){

  for(
    let i=0;
    i<t.length;
    i++
  ){

    const a=
      t[i];

    const b=
      t[t.length-1-i];

    if(
      MIRROR_MAP[a]!==b
    ){

      return false;

    }

  }

  return true;

}


/* ==========================================================
   山彦

   前半 = 後半
========================================================== */

function echo(t){

  if(
    t.length%2!==0
  ){

    return false;

  }

  const half=
    t.length/2;

  return(
    t.slice(0,half)===
    t.slice(half)
  );

}


/* ==========================================================
   双連

   AA BB CC DD ...
========================================================== */

function pair(t){

  if(
    t.length%2!==0
  ){

    return false;

  }

  for(
    let i=0;
    i<t.length;
    i+=2
  ){

    if(
      t[i]!==t[i+1]
    ){

      return false;

    }

  }

  return true;

}


/* ==========================================================
   全数
========================================================== */

function numberOnly(t){

  return /^[0-9]+$/.test(t);

}


/* ==========================================================
   飛石

   / と . を交互に使用

   例:
   Z.y.O.6.0.

========================================================== */

function stepping(t){

  for(
    let i=0;
    i<t.length;
    i++
  ){

    const expected=
      i%2===1
      ? /[/.]/
      : /[^/.]/;

    if(
      !expected.test(t[i])
    ){

      return false;

    }

  }

  return true;

}


/* ==========================================================
   拡飛

   同じ文字で区切る

   例:
   oUlUEUDUDU

   位置 1,3,5... が同じ文字
   ==========================================================
*/

function expanded(t){

  if(t.length<3){
    return false;
  }

  const separator=
    t[1];

  for(
    let i=1;
    i<t.length;
    i+=2
  ){

    if(
      t[i]!==separator
    ){

      return false;

    }

  }

  return true;

}


/* ==========================================================
   特殊判定
========================================================== */

function specialMatches(
  trip,
  type,
  n
){

  const t=
    trip.replace(/^◆/,"");


  switch(type){

    case "pure":
      return pureN(t,n||8);

    case "jun":
      return junN(t,n||8);

    case "double":
      return doubleType(t);

    case "saicho":
      return saicho(t);

    case "saitan":
      return saitan(t);

    case "yakumo":
      return yakumo(t);

    case "mirror":
      return mirror(t);

    case "palindrome":
      return palindrome(t);

    case "echo":
      return echo(t);

    case "pair":
      return pair(t);

    case "number":
      return numberOnly(t);

    case "stepping":
      return stepping(t);

    case "expanded":
      return expanded(t);

    default:
      return true;

  }

}


/* ==========================================================
   全条件
========================================================== */

function matchesAll(
  trip,
  data
){

  if(
    !basicMatches(
      trip,
      data.needles
    )
  ){

    return false;

  }


  if(
    !regexMatches(
      trip,
      data.regexSource
    )
  ){

    return false;

  }


  if(
    data.special &&
    !specialMatches(
      trip,
      data.special,
      data.specialN
    )
  ){

    return false;

  }


  return true;

}


/* ==========================================================
   検索
========================================================== */

let stopped=false;


self.onmessage=function(e){

  const data=e.data;


  if(
    data.cmd==="stop"
  ){

    stopped=true;

    return;

  }


  if(
    data.cmd!=="start"
  ){

    return;

  }


  if(
    typeof unixCryptTD !== "function"
  ){

    postMessage({

      type:"error",

      message:
        "unixCryptTD unavailable"

    });

    return;

  }


  stopped=false;


  const len=
    Number(data.tripLen);


  const unlimited=
    Boolean(data.unlimited);


  const maxAttempts=
    Number(data.maxAttempts);


  const sequential=
    data.searchMode==="sequential";


  const needles=
    data.needles || [];


  const regexSource=
    data.regexSource || "";


  const special=
    data.special || "";


  const specialN=
    Number(data.specialN || 0);


  let attempts=0;

  let found=0;

  let lastProgress=0;

  const seenTrips=
    new Set();


  const started=
    performance.now();


  let index=0;


  /*
    順番探索の場合の総数

    64^10 / 64^12 は非常に大きいため、
    「制限なし」なら実質的に停止するまで探索。
  */

  const total=
    Math.pow(
      CHARS.length,
      len
    );


  while(!stopped){

    /*
      回数制限あり
    */

    if(
      !unlimited &&
      attempts>=maxAttempts
    ){

      break;

    }


    let key;


    if(sequential){

      /*
        JavaScript Numberでは
        64^12 が安全整数を超えるので、
        実用上は循環させる。
      */

      const safeIndex=
        index % total;

      key=
        keyFromIndex(
          safeIndex,
          len
        );

      index++;

    }else{

      key=
        randomKey(len);

    }


    let trip;

    try{

      trip=
        makeTrip(key);

    }catch(error){

      postMessage({

        type:"error",

        message:error.message

      });

      return;

    }


    attempts++;


    /*
      条件判定
    */

    if(
      matchesAll(
        trip,
        {
          needles,
          regexSource,
          special,
          specialN
        }
      )
    ){

      found++;


      /*
        同じトリップを何度も表示しない。

        Unix cryptでは10桁キーの後半が
       同じトリップになるケースがあるため重要。
      */

      if(
        !seenTrips.has(trip)
      ){

        seenTrips.add(trip);


        postMessage({

          type:"hit",

          item:{
            key,
            trip
          }

        });

      }

    }


    /*
      1000回ごとに進捗
    */

    if(
      attempts-lastProgress>=1000
    ){

      lastProgress=
        attempts;


      const sec=
        Math.max(
          (performance.now()-started)/1000,
          0.001
        );


      const rate=
        Math.round(
          attempts/sec
        );


      let progress=-1;


      if(
        !unlimited &&
        maxAttempts>0
      ){

        progress=
          attempts/maxAttempts*100;

      }


      postMessage({

        type:"progress",

        attempts,

        rate,

        found,

        progress

      });

    }

  }


  const sec=
    Math.max(
      (performance.now()-started)/1000,
      0.001
    );


  const rate=
    Math.round(
      attempts/sec
    );


  postMessage({

    type:"done",

    attempts,

    rate,

    found,

    stopped

  });

};
