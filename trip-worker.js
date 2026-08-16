/* =========================================================
   trip-worker.js

   GitHub Pages / localhost対応
========================================================= */


/* =========================================================
   UNIX CRYPT

   index.htmlと同じフォルダに置く
========================================================= */

importScripts(
  "./unix-crypt-td.min.js"
);


/* =========================================================
   CHECK
========================================================= */

if(
  typeof unixCryptTD !== "function"
){

  self.postMessage({

    type:"error",

    message:
      "unixCryptTDをWorkerから読み込めませんでした。"

  });

}else{

  self.postMessage({

    type:"ready"

  });

}


/* =========================================================
   CONSTANTS
========================================================= */

const TRIP_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./";


/* =========================================================
   SALT
========================================================= */

function saltForTrip(key){

  let s =
    (key + "H.").slice(1,3);

  s =
    s.replace(
      /[^\.-z]/g,
      "."
    );

  s =
    s.replace(
      /[\:;<=>?@[\\\]^_`]/g,
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
   TRIP GENERATION
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
   INDEX → KEY
========================================================= */

function keyFromIndex(
  index,
  chars,
  length
){

  let result = "";


  for(
    let i=0;
    i<length;
    i++
  ){

    result =
      chars[
        index % chars.length
      ] +
      result;


    index =
      Math.floor(
        index /
        chars.length
      );

  }


  return result;

}


/* =========================================================
   BUILD MATCHERS
========================================================= */

function buildMatchers(
  conditions
){

  return conditions.map(
    condition => {

      if(
        condition.mode ===
        "regex"
      ){

        return {

          mode:"regex",

          regex:
            new RegExp(
              condition.text
            )

        };

      }


      return {

        mode:
          condition.mode,

        text:
          condition.text
            .replace(
              /^◆/,
              ""
            )

      };

    }
  );

}


/* =========================================================
   MATCH
========================================================= */

function matches(
  trip,
  matchers
){

  const text =
    trip.replace(
      /^◆/,
      ""
    );


  /*
   * 全条件AND
   */

  for(
    const matcher
    of matchers
  ){

    /* 正規表現 */

    if(
      matcher.mode ===
      "regex"
    ){

      matcher.regex.lastIndex =
        0;


      if(
        !matcher.regex.test(
          text
        )
      ){

        return false;

      }


      continue;

    }


    /* 前方一致 */

    if(
      matcher.mode ===
      "prefix"
    ){

      if(
        !text.startsWith(
          matcher.text
        )
      ){

        return false;

      }


      continue;

    }


    /* 後方一致 */

    if(
      matcher.mode ===
      "suffix"
    ){

      if(
        !text.endsWith(
          matcher.text
        )
      ){

        return false;

      }


      continue;

    }


    /* 部分一致 */

    if(
      !text.includes(
        matcher.text
      )
    ){

      return false;

    }

  }


  return true;

}


/* =========================================================
   STATE
========================================================= */

let stopped = false;


/* =========================================================
   MESSAGE
========================================================= */

self.onmessage = event => {

  const data =
    event.data;


  /* =======================================================
     STOP
  ====================================================== */

  if(
    data.cmd === "stop"
  ){

    stopped = true;

    return;

  }


  /* =======================================================
     START
  ====================================================== */

  if(
    data.cmd !== "start"
  ){

    return;

  }


  stopped = false;


  const chars =
    data.chars ||
    TRIP_CHARS;


  const length =
    Number(data.length);


  const maxAttempts =
    Number(data.maxAttempts);


  const workerId =
    Number(data.workerId);


  const workerCount =
    Number(data.workerCount);


  /* =======================================================
     MATCHERS
  ====================================================== */

  let matchers;

  try{

    matchers =
      buildMatchers(
        data.conditions || []
      );

  }catch(error){

    self.postMessage({

      type:"error",

      workerId,

      message:
        "正規表現エラー: " +
        error.message

    });

    return;

  }


  /* =======================================================
     COUNTERS
  ====================================================== */

  let attempts = 0;

  let found = 0;


  /* =======================================================
     SEARCH RANGE
  ====================================================== */

  const total =
    Math.pow(
      chars.length,
      length
    );


  const limit =
    Math.min(
      total,
      maxAttempts
    );


  /*
   * Workerごとに
   *
   * 0,4,8...
   * 1,5,9...
   * 2,6,10...
   * 3,7,11...
   *
   * のように分割。
   */

  let index =
    workerId;


  const PROGRESS_INTERVAL =
    5000;


  const started =
    performance.now();


  /* =======================================================
     SEARCH LOOP
  ====================================================== */

  while(
    index < limit &&
    !stopped
  ){

    const key =
      keyFromIndex(
        index,
        chars,
        length
      );


    const trip =
      makeTrip(key);


    attempts++;


    /* =====================================================
       MATCH
    ==================================================== */

    if(
      matches(
        trip,
        matchers
      )
    ){

      found++;


      self.postMessage({

        type:"hit",

        workerId,

        key,

        trip

      });

    }


    /* =====================================================
       PROGRESS
    ==================================================== */

    if(
      attempts %
      PROGRESS_INTERVAL ===
      0
    ){

      self.postMessage({

        type:"progress",

        workerId,

        attempts,

        found

      });

    }


    /*
     * 次のWorker担当番号へ
     */

    index +=
      workerCount;

  }


  /* =======================================================
     DONE
  ====================================================== */

  const elapsed =
    (
      performance.now() -
      started
    ) / 1000;


  const rate =
    Math.round(
      attempts /
      Math.max(
        elapsed,
        0.001
      )
    );


  self.postMessage({

    type:"done",

    workerId,

    attempts,

    found,

    rate,

    stopped

  });

};