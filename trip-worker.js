"use strict";

/*
  IMPORTANT

  このファイルと同じフォルダに

  unix-crypt-td.min.js

  を置く。

  CDNは使用しない。
*/


const LIB =
  new URL(
    "./unix-crypt-td.min.js",
    self.location.href
  ).href;


/* =========================
   ライブラリ読み込み
========================= */

try{

  importScripts(LIB);

}catch(e){

  postMessage({

    type:"error",

    message:
      "unix-crypt-td.min.js の読み込みに失敗しました。"

  });

}


/* =========================
   確認
========================= */

if(typeof unixCryptTD !== "function"){

  postMessage({

    type:"error",

    message:
      "unixCryptTD unavailable"

  });

}else{

  postMessage({
    type:"ready"
  });

}


/* =========================
   トリップ
========================= */

function saltForTrip(key){

  let s=(key+"H.").slice(1,3);

  s=s.replace(/[^\.-z]/g,".");

  s=s.replace(
    /[\:;<=>?@[\\\]^_`]/g,
    c=>{

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

  if(typeof unixCryptTD !== "function"){

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


/* =========================
   キー生成
========================= */

const CHARS =
  "abcdefghijklmnopqrstuvwxyz" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "0123456789./";


function keyFromIndex(
  index,
  chars,
  len
){

  let out="";

  for(let i=0;i<len;i++){

    out =
      chars[index % chars.length] +
      out;

    index =
      Math.floor(
        index / chars.length
      );

  }

  return out;

}


/* =========================
   通常条件
========================= */

function normalMatches(
  trip,
  needles
){

  const t=trip.slice(1);

  return needles.every(n=>{

    if(n.mode==="prefix")
      return t.startsWith(n.text);

    if(n.mode==="suffix")
      return t.endsWith(n.text);

    if(n.mode==="exact")
      return t===n.text;

    return t.includes(n.text);

  });

}


/* =========================
   正規表現
========================= */

function regexMatches(
  trip,
  needles
){

  const t=trip.slice(1);

  return needles.every(n=>{

    try{

      const re =
        new RegExp(n.text);

      return re.test(t);

    }catch(e){

      return false;

    }

  });

}


/* =========================
   特殊トリップ
========================= */

function pureN(t){

  for(let n=10;n>=8;n--){

    for(let i=0;i<=t.length-n;i++){

      if(
        t.slice(i,i+n)
        .split("")
        .every(c=>c===t[i])
      ){

        return true;

      }

    }

  }

  return false;

}


function semiN(t){

  for(let n=10;n>=9;n--){

    for(let i=0;i<=t.length-n;i++){

      const x=t[i].toLowerCase();

      if(
        t.slice(i,i+n)
        .split("")
        .every(
          c=>c.toLowerCase()===x
        )
      ){

        return true;

      }

    }

  }

  return false;

}


function twoStructure(t){

  return new Set(t).size===2;

}


function longest(t){

  return /^[MmW]+$/.test(t);

}


function shortest(t){

  return /^[li.]+$/.test(t);

}


function yakumo(t){

  if(t.length===10){

    return /^(.)(\1){2}(.)(\2){2}(.)(\3){2}.$/.test(t);

  }

  return false;

}


function mirror(t){

  const map={

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

    "i":"i",
    "l":"l",
    "o":"o",
    "p":"q",
    "q":"p",
    "v":"v",
    "w":"w",
    "x":"x"

  };

  for(
    let i=0;
    i<t.length;
    i++
  ){

    const a=t[i];

    const b=t[t.length-1-i];

    if(map[a]!==b)
      return false;

  }

  return true;

}


function palindrome(t){

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


function echo(t){

  if(t.length%2!==0)
    return false;

  const half=t.length/2;

  return(
    t.slice(0,half) ===
    t.slice(half)
  );

}


function doublePair(t){

  if(t.length%2!==0)
    return false;

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


function numberOnly(t){

  return /^[0-9]+$/.test(t);

}


function stepping(t){

  for(let i=0;i<t.length;i++){

    if(
      i%2===0
        ? !/[\/.]/.test(t[i])
        : /[\/.]/.test(t[i])
    ){

      return false;

    }

  }

  return true;

}


function wideStepping(t){

  if(t.length<2)
    return false;

  for(
    let i=1;
    i<t.length;
    i++
  ){

    if(t[i]!==t[i-2] && i>=2){

      return false;

    }

  }

  return true;

}


function specialMatches(
  trip,
  type
){

  if(!type)
    return true;

  const t=trip.slice(1);

  switch(type){

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


/* =========================
   停止
========================= */

let stopped=false;


self.onmessage=e=>{

  const data=e.data;


  if(data.cmd==="stop"){

    stopped=true;

    return;

  }


  if(data.cmd!=="start")
    return;


  stopped=false;


  const {

    tripLen,
    needles,
    searchMode,
    special

  }=data;


  let attempts=0;

  let found=0;

  const started=
    performance.now();


  /*
    最大試行回数なし。

    JavaScriptの安全な整数範囲まで
    理論上探索可能。
  */

  const total =
    Math.pow(
      CHARS.length,
      tripLen
    );


  let index=0;


  const BATCH=1000;


  while(
    index<total &&
    !stopped
  ){

    for(
      let j=0;
      j<BATCH &&
      index<total &&
      !stopped;
      j++,index++
    ){

      const key =
        keyFromIndex(
          index,
          CHARS,
          tripLen
        );


      const trip =
        makeTrip(key);


      attempts++;


      let matched;


      if(searchMode==="regex"){

        matched =
          regexMatches(
            trip,
            needles
          );

      }else{

        matched =
          normalMatches(
            trip,
            needles
          );

      }


      if(
        matched &&
        specialMatches(
          trip,
          special
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

    }


    if(
      attempts%1000===0
    ){

      const sec =
        (performance.now()-started)/1000;


      postMessage({

        type:"progress",

        attempts,

        rate:
          Math.round(
            attempts/
            Math.max(sec,.001)
          ),

        found

      });

    }

  }


  const sec =
    (performance.now()-started)/1000;


  postMessage({

    type:"done",

    attempts,

    rate:
      Math.round(
        attempts/
        Math.max(sec,.001)
      ),

    found,

    stopped

  });

};
