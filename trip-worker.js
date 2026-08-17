/* =========================================================
   trip-worker.js
   ========================================================= */

/*
  同じフォルダのライブラリを読み込む。

  unix-crypt-td.min.js の最後は

      window.unixCryptTD=z;

  になっているため、Workerでは window がありません。

  しかし var z=... はWorkerのグローバルに存在するので、
  読み込み後に self.unixCryptTD にコピーします。
*/

try {

  importScripts("./unix-crypt-td.min.js");

  if(
    typeof self.unixCryptTD !== "function" &&
    typeof self.z === "function"
  ){

    self.unixCryptTD=self.z;
  }

}catch(e){

  postMessage({
    type:"error",
    message:
      "unix-crypt-td.min.js の読み込み失敗: "+
      e.message
  });
}


/* =========================================================
   LIBRARY CHECK
========================================================= */

if(typeof self.unixCryptTD!=="function"){

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


/* =========================================================
   TRIP
========================================================= */

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

      return table[c]||c;
    }
  );

  return s;
}


function makeTrip(key){

  if(typeof self.unixCryptTD!=="function"){

    throw new Error(
      "unixCryptTD unavailable"
    );
  }

  return "◆"+
    self.unixCryptTD(
      key,
      saltForTrip(key)
    ).slice(-10);
}


/* =========================================================
   KEY SPACE
========================================================= */

const CHARS=
  "abcdefghijklmnopqrstuvwxyz"+
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ"+
  "0123456789./";


/*
  BigIntを使うことで12桁探索でも
  Numberの安全整数上限を超えない。
*/

function keyFromIndex(index,len){

  let out="";

  const base=
    BigInt(CHARS.length);

  let n=index;

  for(
    let i=0;
    i<len;
    i++
  ){

    const r=
      Number(n%base);

    out=
      CHARS[r]+out;

    n=
      n/base;
  }

  return out;
}


/* =========================================================
   SPECIAL TRIPS
========================================================= */

function pureN(t){

  let max=1;
  let cur=1;

  for(let i=1;i<t.length;i++){

    if(t[i]===t[i-1]){

      cur++;

      if(cur>max)max=cur;

    }else{

      cur=1;
    }
  }

  return max>=8;
}


function semiN(t){

  let max=1;
  let cur=1;

  for(let i=1;i<t.length;i++){

    if(
      t[i].toLowerCase()===
      t[i-1].toLowerCase()
    ){

      cur++;

      if(cur>max)max=cur;

    }else{

      cur=1;
    }
  }

  return max>=9;
}


function twoStructure(t){

  return new Set(t.split("")).size<=2;
}


function longest(t){

  return /^[MmW]+$/.test(t);
}


function shortest(t){

  return /^[li.]+$/.test(t);
}


function yakumo(t){

  /*
    3文字ずつ同じ。

    10桁の場合は
    AAA BBB CCC + 1文字
    の形も許可。
  */

  const full=Math.floor(t.length/3);

  for(let i=0;i<full;i++){

    const start=i*3;

    if(
      t[start]!==t[start+1] ||
      t[start]!==t[start+2]
    ){

      return false;
    }
  }

  return true;
}


/*
  鏡用の見た目対応。

  同じ見た目として扱う文字をペア化。
*/

const MIRROR_PAIRS={

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


function mirror(t){

  for(let i=0;i<t.length;i++){

    const a=t[i];

    const b=t[t.length-1-i];

    if(
      MIRROR_PAIRS[a]!==b
    ){

      return false;
    }
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
      t[i]!==t[t.length-1-i]
    ){

      return false;
    }
  }

  return true;
}


function echo(t){

  if(t.length%2!==0){

    return false;
  }

  const half=
    t.length/2;

  return(
    t.slice(0,half)===
    t.slice(half)
  );
}


function doublePair(t){

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


function allNumbers(t){

  return /^[0-9]+$/.test(t);
}


function stepping(t){

  if(t.length<2){
    return false;
  }

  for(
    let i=1;
    i<t.length;
    i+=2
  ){

    if(
      t[i]!=="." &&
      t[i]!=="/"
    ){

      return false;
    }
  }

  return true;
}


function expanded(t){

  if(t.length<2){
    return false;
  }

  /*
    例：
    oUlUEUDUDU

    1文字おきに同じ区切り文字
  */

  const separators=[];

  for(
    let i=1;
    i<t.length;
    i+=2
  ){

    separators.push(t[i]);
  }

  if(!separators.length){
    return false;
  }

  return separators.every(
    x=>x===separators[0]
  );
}


/* =========================================================
   SPECIAL DISPATCH
========================================================= */

function specialMatch(t,type){

  switch(type){

    case "pure":
      return pureN(t);

    case "semi":
      return semiN(t);

    case "two":
      return twoStructure(t);

    case "longest":
      return longest(t);

    case "shortest":
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
      return allNumbers(t);

    case "stepping":
      return stepping(t);

    case "expanded":
      return expanded(t);

    case "none":
    default:
      return true;
  }
}


/* =========================================================
   NORMAL / REGEX
========================================================= */

function normalMatch(
  t,
  needles
){

  return needles.every(n=>{

    const needle=
      String(n.text)
        .replace(/^◆/,"");

    switch(n.mode){

      case "prefix":
        return t.startsWith(needle);

      case "suffix":
        return t.endsWith(needle);

      case "exact":
        return t===needle;

      case "contains":
      default:
        return t.includes(needle);
    }

  });
}


function regexMatch(
  t,
  needles
){

  return needles.every(n=>{

    try{

      return new RegExp(
        n.text
      ).test(t);

    }catch(e){

      return false;
    }

  });
}


/* =========================================================
   START / STOP
========================================================= */

let stopped=false;


self.onmessage=e=>{

  const data=e.data;


  if(data.type==="stop"){

    stopped=true;

    return;
  }


  if(data.type!=="start"){
    return;
  }


  stopped=false;


  const{

    workerId,
    workerCount,
    tripLen,
    needles,
    matchMode,
    special

  }=data;


  let attempts=0;

  let found=0;


  /*
    Workerごとにスタート地点をずらす。

    0,1,2,3...
    のように担当を分割する。
  */

  let index=
    BigInt(workerId);

  const stride=
    BigInt(workerCount);


  let lastReport=
    performance.now();


  while(!stopped){

    try{

      const key=
        keyFromIndex(
          index,
          tripLen
        );


      const trip=
        makeTrip(key);


      const t=
        trip.slice(1);


      let normalOK=true;


      if(matchMode==="regex"){

        normalOK=
          regexMatch(
            t,
            needles
          );

      }else{

        normalOK=
          normalMatch(
            t,
            needles
          );
      }


      if(
        normalOK &&
        specialMatch(
          t,
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


      attempts++;


      /*
        2000回ごとに進捗送信。
        メッセージ回数を減らして速度を優先。
      */

      if(
        attempts%2000===0
      ){

        const now=
          performance.now();

        if(
          now-lastReport>=100
        ){

          postMessage({

            type:"progress",

            attempts,
            found

          });

          lastReport=now;
        }

      }


      index+=stride;


    }catch(error){

      postMessage({

        type:"error",

        message:
          error.message||
          String(error)

      });

      stopped=true;
    }

  }


  postMessage({

    type:"done",

    attempts,

    found,

    stopped:true

  });

};
