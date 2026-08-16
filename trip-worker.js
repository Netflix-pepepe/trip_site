/*
 * trip-worker.js
 * GitHub Pages / Web Worker対応
 */


/* =====================================================
   unix-crypt-td-js 読み込み
===================================================== */

let unixCryptTD = null;

try {

  /*
   * index.htmlと同じ場所から読み込む
   */
  const libURL =
    new URL(
      "./unix-crypt-td.min.js",
      self.location.href
    ).href;

  importScripts(libURL);


  /*
   * 重要：
   *
   * unix-crypt-td.min.js は
   *
   * window.unixCryptTD = z
   *
   * という形式になっています。
   *
   * Web Workerにはwindowがないため、
   * グローバル変数 z を取得します。
   */

  if (
    typeof self.z === "function"
  ) {

    unixCryptTD =
      self.z;

  }


  /*
   * 念のためunixCryptTD自身も確認
   */

  if (
    typeof self.unixCryptTD === "function"
  ) {

    unixCryptTD =
      self.unixCryptTD;

  }


} catch (error) {

  self.postMessage({

    type: "error",

    message:
      "cryptライブラリ読み込みエラー: " +
      error.message

  });

}


/* =====================================================
   読み込み確認
===================================================== */

if (
  typeof unixCryptTD !== "function"
) {

  self.postMessage({

    type: "error",

    message:
      "unixCryptTD unavailable"

  });

} else {

  self.postMessage({

    type: "ready"

  });

}


/* =====================================================
   SALT
===================================================== */

function saltForTrip(key) {

  let s =
    (key + "H.").slice(1, 3);


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


/* =====================================================
   TRIP生成
===================================================== */

function makeTrip(key) {

  if (
    typeof unixCryptTD !==
    "function"
  ) {

    throw new Error(
      "unixCryptTD unavailable"
    );

  }


  return (
    "◆" +
    unixCryptTD(
      key,
      saltForTrip(key)
    ).slice(-10)
  );

}


/* =====================================================
   INDEX → KEY
===================================================== */

function keyFromIndex(
  index,
  chars,
  length
) {

  let result = "";


  for (
    let i = 0;
    i < length;
    i++
  ) {

    result =
      chars[
        index % chars.length
      ] +
      result;


    index =
      Math.floor(
        index / chars.length
      );

  }


  return result;

}


/* =====================================================
   MATCHER
===================================================== */

function buildMatchers(
  conditions
) {

  return conditions.map(
    condition => {

      if (
        condition.mode ===
        "regex"
      ) {

        return {

          mode: "regex",

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


/* =====================================================
   MATCH
===================================================== */

function matches(
  trip,
  matchers
) {

  const text =
    trip.replace(
      /^◆/,
      ""
    );


  for (
    const matcher
    of matchers
  ) {


    /* 正規表現 */

    if (
      matcher.mode ===
      "regex"
    ) {

      matcher.regex.lastIndex =
        0;


      if (
        !matcher.regex.test(
          text
        )
      ) {

        return false;

      }


      continue;

    }


    /* 前方一致 */

    if (
      matcher.mode ===
      "prefix"
    ) {

      if (
        !text.startsWith(
          matcher.text
        )
      ) {

        return false;

      }


      continue;

    }


    /* 後方一致 */

    if (
      matcher.mode ===
      "suffix"
    ) {

      if (
        !text.endsWith(
          matcher.text
        )
      ) {

        return false;

      }


      continue;

    }


    /* 部分一致 */

    if (
      !text.includes(
        matcher.text
      )
    ) {

      return false;

    }

  }


  return true;

}


/* =====================================================
   STATE
===================================================== */

let stopped =
  false;


/* =====================================================
   MESSAGE
===================================================== */

self.onmessage =
  event => {

    const data =
      event.data;


    /* ================================
       STOP
    ================================= */

    if (
      data.cmd === "stop"
    ) {

      stopped =
        true;

      return;

    }


    /* ================================
       START以外
    ================================= */

    if (
      data.cmd !== "start"
    ) {

      return;

    }


    /* ================================
       crypt確認
    ================================= */

    if (
      typeof unixCryptTD !==
      "function"
    ) {

      self.postMessage({

        type: "error",

        workerId:
          data.workerId,

        message:
          "Worker内でunixCryptTDが使用できません。"

      });

      return;

    }


    stopped =
      false;


    const chars =
      data.chars;


    const length =
      Number(
        data.length
      );


    const maxAttempts =
      Number(
        data.maxAttempts
      );


    const workerId =
      Number(
        data.workerId
      );


    const workerCount =
      Number(
        data.workerCount
      );


    /* ================================
       matcher
    ================================= */

    let matchers;


    try {

      matchers =
        buildMatchers(
          data.conditions ||
          []
        );

    } catch (error) {

      self.postMessage({

        type: "error",

        workerId,

        message:
          "正規表現エラー: " +
          error.message

      });

      return;

    }


    /* ================================
       counter
    ================================= */

    let attempts =
      0;


    let found =
      0;


    /* ================================
       search range
    ================================= */

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
     * Workerごとに分散
     *
     * Worker 0:
     * 0, 4, 8, 12...
     *
     * Worker 1:
     * 1, 5, 9, 13...
     */

    let index =
      workerId;


    const started =
      performance.now();


    const PROGRESS_INTERVAL =
      5000;


    /* ================================
       search
    ================================= */

    while (
      index < limit &&
      !stopped
    ) {

      const key =
        keyFromIndex(
          index,
          chars,
          length
        );


      const trip =
        makeTrip(key);


      attempts++;


      /* ==============================
         match
      =============================== */

      if (
        matches(
          trip,
          matchers
        )
      ) {

        found++;


        self.postMessage({

          type: "hit",

          workerId,

          key,

          trip

        });

      }


      /* ==============================
         progress
      =============================== */

      if (
        attempts %
        PROGRESS_INTERVAL ===
        0
      ) {

        self.postMessage({

          type: "progress",

          workerId,

          attempts,

          found

        });

      }


      index +=
        workerCount;

    }


    /* ================================
       done
    ================================= */

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

      type: "done",

      workerId,

      attempts,

      found,

      rate,

      stopped

    });

  };
