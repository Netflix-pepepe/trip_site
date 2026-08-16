"use strict";

/*
 * ============================================================
 * unix-crypt-td-js 1.1.4
 * Worker内蔵版
 * ============================================================
 *
 * これをWorker内で直接実行することで、
 *
 * importScripts(CDN)
 *
 * に依存しません。
 */

var unixCryptTD = (function(){

function toBytes(e){
  var a,t=[];

  for(a=0;a<e.length;++a){
    t[a]=e.charCodeAt(a);
  }

  return t;
}

var A=[
58,50,42,34,26,18,10,2,
60,52,44,36,28,20,12,4,
62,54,46,38,30,22,14,6,
64,56,48,40,32,24,16,8,
57,49,41,33,25,17,9,1,
59,51,43,35,27,19,11,3,
61,53,45,37,29,21,13,5,
63,55,47,39,31,23,15,7
];

var B=[
40,8,48,16,56,24,64,32,
39,7,47,15,55,23,63,31,
38,6,46,14,54,22,62,30,
37,5,45,13,53,21,61,29,
36,4,44,12,52,20,60,28,
35,3,43,11,51,19,59,27,
34,2,42,10,50,18,58,26,
33,1,41,9,49,17,57,25
];

var C=[
57,49,41,33,25,17,9,1,
58,50,42,34,26,18,10,2,
59,51,43,35,27,19,11,3,
60,52,44,36,28,20
];

var D=[
63,55,47,39,31,23,15,7,
62,54,46,38,30,22,14,6,
61,53,45,37,29,21,13,5,
28,20,12,4
];

var E=[
1,1,2,2,2,2,2,2,
1,2,2,2,2,2,2,1
];

var F=[
14,17,11,24,1,5,3,28,
15,6,21,10,23,19,12,4,
26,8,16,7,27,20,13,2
];

var G=[
41,52,31,37,47,55,30,40,
51,45,33,48,44,49,39,56,
34,53,46,42,50,36,29,32
];

var m=[],n=[],u=[],w=0;

for(w=0;w<16;++w){
  u[w]=[];
}

var p=[];

var H=[
32,1,2,3,4,5,
4,5,6,7,8,9,
8,9,10,11,12,13,
12,13,14,15,16,17,
16,17,18,19,20,21,
20,21,22,23,24,25,
24,25,26,27,28,29,
28,29,30,31,32,1
];

var I=[

[
14,4,13,1,2,15,11,8,
3,10,6,12,5,9,0,7,
0,15,7,4,14,2,13,1,
10,6,12,11,9,5,3,8,
4,1,14,8,13,6,2,11,
15,12,9,7,3,10,5,0,
15,12,8,2,4,9,1,7,
5,11,3,14,10,0,6,13
],

[
15,1,8,14,6,11,3,4,
9,7,2,13,12,0,5,10,
3,13,4,7,15,2,8,14,
12,0,1,10,6,9,11,5,
0,14,7,11,10,4,13,1,
5,8,12,6,9,3,2,15,
13,8,10,1,3,15,4,2,
11,6,7,12,0,5,14,9
],

[
10,0,9,14,6,3,15,5,
1,13,12,7,11,4,2,8,
13,7,0,9,3,4,6,10,
2,8,5,14,12,11,15,1,
13,6,4,9,8,15,3,0,
11,1,2,12,5,10,14,7,
1,10,13,0,6,9,8,7,
4,15,14,3,11,5,2,12
],

[
7,13,14,3,0,6,9,10,
1,2,8,5,11,12,4,15,
13,8,11,5,6,15,0,3,
4,7,2,12,1,10,14,9,
10,6,9,0,12,11,7,13,
15,1,3,14,5,2,8,4,
3,15,0,6,10,1,13,8,
9,4,5,11,12,7,2,14
],

[
2,12,4,1,7,10,11,6,
8,5,3,15,13,0,14,9,
14,11,2,12,4,7,13,1,
5,0,15,10,3,9,8,6,
4,2,1,11,10,13,7,8,
15,9,12,5,6,3,0,14,
11,8,12,7,1,14,2,13,
6,15,0,9,10,4,5,3
],

[
12,1,10,15,9,2,6,8,
0,13,3,4,14,7,5,11,
10,15,4,2,7,12,9,5,
6,1,13,14,0,11,3,8,
9,14,15,5,2,8,12,3,
7,0,4,10,1,13,11,6,
4,3,2,12,9,5,15,10,
11,14,1,7,6,0,8,13
],

[
4,11,2,14,15,0,8,13,
3,12,9,7,5,10,6,1,
13,0,11,7,4,9,1,10,
14,3,5,12,2,15,8,6,
1,4,11,13,12,3,7,14,
10,15,6,8,0,5,9,2,
6,11,13,8,1,4,10,7,
9,5,0,15,14,2,3,12
],

[
13,2,8,4,6,15,11,1,
10,9,3,14,5,0,12,7,
1,15,13,8,10,3,7,4,
12,5,6,11,0,14,9,2,
7,11,4,1,9,12,14,2,
0,6,10,13,15,3,5,8,
2,1,14,7,4,10,8,13,
15,12,9,0,3,5,6,11
]

];

var J=[
16,7,20,21,29,12,28,17,
1,15,23,26,5,18,31,10,
2,8,24,14,32,27,3,9,
19,13,30,6,22,11,4,25
];

var q=[],g=[],y=[[]],r=[],h=[];


return function(e,a,t){

  if(typeof e==="string"){
    e=toBytes(e);
  }

  if(typeof a==="string"){
    a=toBytes(a);
  }

  var b,c,f,d,k=[],l=[];

  for(b=0;b<66;b++){
    k[b]=0;
  }

  for(f=b=0;(d=e[f])&&64>b;++f){

    for(c=0;c<7;c++,b++){
      k[b]=d>>6-c&1;
    }

    b++;
  }

  for(b=0;b<28;b++){

    m[b]=k[C[b]-1];
    n[b]=k[D[b]-1];

  }

  for(b=0;b<16;b++){

    for(f=0;f<E[b];f++){

      d=m[0];

      for(c=0;c<27;c++){
        m[c]=m[c+1];
      }

      m[27]=d;

      d=n[0];

      for(c=0;c<27;c++){
        n[c]=n[c+1];
      }

      n[27]=d;

    }

    for(c=0;c<24;c++){

      u[b][c]=m[F[c]-1];

      u[b][c+24]=
        n[G[c]-28-1];

    }

  }

  for(b=0;b<66;b++){
    k[b]=0;
  }

  for(b=0;b<48;b++){
    p[b]=H[b];
  }

  for(f=b=0;2>b;b++,++f){

    for(
      d=a[f],l[b]=d,
      90<d&&(d-=6),
      57<d&&(d-=7),
      d-=46,
      c=0;
      6>c;
      c++
    ){

      if(d>>c&1){

        e=p[6*b+c];

        p[6*b+c]=
          p[6*b+c+24];

        p[6*b+c+24]=e;

      }

    }

  }

  for(b=0;b<25;b++){

    f=k;
    d=[];

    for(a=0;a<64;a++){
      d[a]=f[A[a]-1];
    }

    for(a=0;a<32;++a){

      q[a]=d[a];
      g[a]=d[a+32];

    }

    for(c=0;c<16;c++){

      e=c;

      for(a=0;a<32;a++){
        y[a]=g[a];
      }

      for(a=0;a<48;a++){

        h[a]=
          g[p[a]-1]^u[e][a];

      }

      for(a=0;a<8;a++){

        e=6*a;

        var v=
          I[a][
            (h[e]<<5)+
            (h[e+1]<<3)+
            (h[e+2]<<2)+
            (h[e+3]<<1)+
            (h[e+4]<<0)+
            (h[e+5]<<4)
          ];

        e=4*a;

        r[e]=v>>3&1;
        r[e+1]=v>>2&1;
        r[e+2]=v>>1&1;
        r[e+3]=v>>0&1;

      }

      for(a=0;a<32;a++){

        g[a]=
          q[a]^r[J[a]-1];

      }

      for(a=0;a<32;a++){

        q[a]=y[a];

      }

    }

    for(a=0;a<32;a++){

      e=q[a];

      q[a]=g[a];
      g[a]=e;

    }

    for(a=0;a<32;a++){

      d[a]=q[a];
      d[a+32]=g[a];

    }

    for(a=0;a<64;a++){

      f[a]=
        d[B[a]-1];

    }

  }

  for(b=0;b<11;b++){

    for(c=d=0;c<6;c++){

      d<<=1;
      d|=k[6*b+c];

    }

    d+=46;

    if(57<d){
      d+=7;
    }

    if(90<d){
      d+=6;
    }

    l[b+2]=d;

  }

  if(0==l[1]){
    l[1]=l[0];
  }

  return t
    ? l
    : String.fromCharCode.apply(String,l);

};

})();


/*
 * ============================================================
 * ここから検索エンジン
 * ============================================================
 */

function saltForTrip(key){

  let s=(key+"H.").slice(1,3);

  s=s.replace(/[^\x2e-\x7a]/g,".");

  s=s.replace(/[\x3a-\x40\x5b-\x60]/g,c=>{

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

  });

  return s;
}


function makeTrip(key,len){

  const result =
    unixCryptTD(
      key,
      saltForTrip(key)
    );

  return "◆"+result.slice(-len);
}


/*
 * ============================================================
 * 特殊トリップ判定
 * ============================================================
 */

function pureRun(t){

  let best=1;

  let current=1;

  for(let i=1;i<t.length;i++){

    if(t[i]===t[i-1]){
      current++;
    }else{
      current=1;
    }

    if(current>best){
      best=current;
    }

  }

  return best;
}


function semiRun(t){

  let best=1;

  let current=1;

  for(let i=1;i<t.length;i++){

    if(
      t[i].toLowerCase() ===
      t[i-1].toLowerCase()
    ){

      current++;

    }else{

      current=1;

    }

    if(current>best){
      best=current;
    }

  }

  return best;
}


function isTwo(t){

  return new Set(t.split("")).size <= 2;
}


function isLongest(t){

  return /^[MmW]+$/.test(t);
}


function isShortest(t){

  return /^[li.]+$/.test(t);
}


function isYakumo(t){

  if(t.length===10){

    for(let i=0;i<9;i+=3){

      if(
        t[i]!==t[i+1] ||
        t[i]!==t[i+2]
      ){
        return false;
      }

    }

    return true;
  }


  if(t.length===12){

    for(let i=0;i<12;i+=3){

      if(
        t[i]!==t[i+1] ||
        t[i]!==t[i+2]
      ){
        return false;
      }

    }

    return true;
  }

  return false;
}


/*
 * 鏡
 *
 * 左右対称に「見える」文字の対応。
 */

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

  "i":"i",
  "l":"l",

  "o":"o",
  "p":"q",
  "q":"p",

  "v":"v",
  "w":"w",
  "x":"x"
};


function isMirror(t){

  for(let i=0;i<t.length;i++){

    const left=t[i];

    const right=t[t.length-1-i];

    if(MIRROR_MAP[left]!==right){

      return false;

    }

  }

  return true;
}


function isPalindrome(t){

  for(let i=0;i<Math.floor(t.length/2);i++){

    if(
      t[i] !==
      t[t.length-1-i]
    ){
      return false;
    }

  }

  return true;
}


function isEcho(t){

  if(t.length%2!==0){
    return false;
  }

  const half=t.length/2;

  return (
    t.slice(0,half) ===
    t.slice(half)
  );
}


function isDouble(t){

  if(t.length%2!==0){
    return false;
  }

  for(let i=0;i<t.length;i+=2){

    if(t[i]!==t[i+1]){
      return false;
    }

  }

  return true;
}


function isNumbers(t){

  return /^[0-9]+$/.test(t);
}


function isTobiishi(t){

  /*
   * 例：
   * Z.y.O.6.0.
   *
   * 1,3,5... = 任意
   * 2,4,6... = . または /
   */

  for(let i=1;i<t.length;i+=2){

    if(
      t[i] !== "." &&
      t[i] !== "/"
    ){
      return false;
    }

  }

  return true;
}


function isKakutobi(t){

  /*
   * 例：
   * oUlUEUDUDU
   *
   * 偶数位置がすべて同じ。
   */

  if(t.length<2){
    return false;
  }

  const separator=t[1];

  for(let i=1;i<t.length;i+=2){

    if(t[i]!==separator){
      return false;
    }

  }

  return true;
}


function specialName(t,type){

  switch(type){

    case "pure":

      return pureRun(t)>=3
        ? `純${pureRun(t)}連`
        : false;

    case "semi":

      return semiRun(t)>=3
        ? `準${semiRun(t)}連`
        : false;

    case "two":

      return isTwo(t) ? "二構" : false;

    case "longest":

      return isLongest(t) ? "最長" : false;

    case "shortest":

      return isShortest(t) ? "最短" : false;

    case "yakumo":

      return isYakumo(t) ? "八雲" : false;

    case "mirror":

      return isMirror(t) ? "鏡" : false;

    case "palindrome":

      return isPalindrome(t) ? "回文" : false;

    case "echo":

      return isEcho(t) ? "山彦" : false;

    case "double":

      return isDouble(t) ? "双連" : false;

    case "numbers":

      return isNumbers(t) ? "全数" : false;

    case "tobiishi":

      return isTobiishi(t) ? "飛石" : false;

    case "kakutobi":

      return isKakutobi(t) ? "拡飛" : false;

    default:

      return true;

  }

}


/*
 * ============================================================
 * 条件判定
 * ============================================================
 */

function conditionMatch(
  text,
  condition,
  regexMode
){

  const needle =
    condition.text;

  if(!needle){
    return true;
  }


  if(regexMode){

    try{

      const re =
        new RegExp(needle);

      return re.test(text);

    }catch(e){

      return false;

    }

  }


  switch(condition.mode){

    case "prefix":

      return text.startsWith(needle);

    case "suffix":

      return text.endsWith(needle);

    case "exact":

      return text === needle;

    default:

      return text.includes(needle);

  }

}


function matchesAll(
  trip,
  conditions,
  regexMode,
  special
){

  const t=trip.slice(1);


  /*
   * 通常条件
   */

  for(const condition of conditions){

    if(
      !conditionMatch(
        t,
        condition,
        regexMode
      )
    ){

      return false;

    }

  }


  /*
   * 特殊条件
   */

  if(special){

    if(!specialName(t,special)){

      return false;

    }

  }


  return true;
}


/*
 * ============================================================
 * 高速キー生成
 * ============================================================
 */

const CHARS =
  "abcdefghijklmnopqrstuvwxyz" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "0123456789./";


function keyFromIndex(
  index,
  len
){

  let out="";

  for(let i=0;i<len;i++){

    out =
      CHARS[index % CHARS.length] +
      out;

    index =
      Math.floor(
        index / CHARS.length
      );

  }

  return out;
}


/*
 * ============================================================
 * Worker
 * ============================================================
 */

let stopped=false;


self.postMessage({
  type:"ready"
});


self.onmessage = e => {

  if(!e.data){
    return;
  }


  if(e.data.cmd==="stop"){

    stopped=true;

    return;

  }


  if(e.data.cmd!=="start"){
    return;
  }


  stopped=false;


  const {

    tripLen,
    maxAttempts,
    unlimited,
    conditions,
    regexMode,
    special

  }=e.data;


  let attempts=0;

  let found=0;

  const started =
    performance.now();


  /*
   * 64^10 / 64^12 は非常に巨大なので
   * JavaScript Numberの整数安全範囲を超える。
   *
   * 無制限検索ではカウンタを実際に回した回数として扱う。
   */

  let index=0;


  try{

    while(
      !stopped &&
      (
        unlimited ||
        attempts < maxAttempts
      )
    ){

      const key =
        keyFromIndex(
          index,
          tripLen
        );


      const trip =
        makeTrip(
          key,
          tripLen
        );


      attempts++;


      if(
        matchesAll(
          trip,
          conditions,
          regexMode,
          special
        )
      ){

        found++;


        const specialLabel =
          special
            ? specialName(
                trip.slice(1),
                special
              )
            : "";


        self.postMessage({

          type:"hit",

          item:{
            key,
            trip,
            special:
              specialLabel || ""
          }

        });

      }


      index++;


      /*
       * まとめて進捗を送信して
       * postMessageのオーバーヘッドを減らす。
       */

      if(
        attempts % 5000 === 0
      ){

        const sec =
          (
            performance.now() -
            started
          ) / 1000;


        const rate =
          Math.round(
            attempts /
            Math.max(sec,0.001)
          );


        self.postMessage({

          type:"progress",

          attempts,
          rate,
          found

        });

      }

    }


    const sec =
      (
        performance.now() -
        started
      ) / 1000;


    const rate =
      Math.round(
        attempts /
        Math.max(sec,0.001)
      );


    self.postMessage({

      type:"done",

      attempts,
      rate,
      found,

      stopped

    });

  }catch(error){

    self.postMessage({

      type:"error",

      message:
        error && error.message
          ? error.message
          : String(error)

    });

  }

};
