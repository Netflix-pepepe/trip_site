/*
 * trip-worker.js
 * GitHub Pages対応
 *
 * unix-crypt-td.min.jsをfetchしてWorker内で読み込む
 */

let unixCryptTD = null;
let stopped = false;


/* =====================================================
   cryptライブラリ読み込み
===================================================== */

async function loadCrypt() {

  const url =
    new URL(
      "./unix-crypt-td.min.js",
      self.location.href
    ).href;

  console.log(
    "[Worker] loading:",
    url
  );


  const response =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "unix-crypt-td.min.js HTTP " +
      response.status
    );

  }


  const source =
    await response.text();


  if (
    !source ||
    source.length < 100
  ) {

    throw new Error(
      "unix-crypt-td.min.jsの内容が空です"
    );

  }


  /*
   * ライブラリ本体は
   *
   * var z = function(){...}();
   *
   * という形式。
   *
   * Workerにはwindowがないので、
   * new Function()で実行して
   * zを直接取得する。
   */

  const getCrypt =
    new Function(
      source +
      "\nreturn z;"
    );


  const crypt =
    getCrypt();


  if (
    typeof crypt !== "function"
  ) {

    throw new Error(
      "crypt関数の取得に失敗しました"
    );

  }


  unixCryptTD =
    crypt;


  console.log(
    "[Worker] unixCryptTD ready"
  );

}


/* =====================================================
   起動時ロード
===================================================== */

const cryptReady =
  loadCrypt()
    .then(() => {

      self.postMessage({

        type: "ready"

      });

    })
    .catch(error => {

      console.error(
        "[Worker] crypt load error:",
        error
      );


      self.postMessage({

        type: "error",

        message:
          "unix-crypt-td.min.jsの読み込み失敗: " +
          error.message

      });


      throw error;

    });


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
   MATCHER作成
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
          String(
            condition.text
          )
          .trim()
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
   Worker
===================================================== */

self.onmessage =
  async event => {

    const data =
      event.data;


    /* STOP */

    if (
      data.cmd === "stop"
    ) {

      stopped =
        true;

      return;

    }


    /* START */

    if (
      data.cmd !== "start"
    ) {

      return;

    }


    /*
     * cryptライブラリの読み込みが
     * 完了するまで待つ
     */

    try {

      await cryptReady;

    } catch (error) {

      self.postMessage({

        type: "error",

        workerId:
          data.workerId,

        message:
          "cryptライブラリを読み込めませんでした: " +
          error.message

      });

      return;

    }


    if (
      typeof unixCryptTD !==
      "function"
    ) {

      self.postMessage({

        type: "error",

        workerId:
          data.workerId,

        message:
          "unixCryptTD unavailable"

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


    /* matcher */

    let matchers;


    try {

      matchers =
        buildMatchers(
          data.conditions || []
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


    /* 検索範囲 */

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


    let attempts =
      0;


    let found =
      0;


    const started =
      performance.now();


    /*
     * Workerごとに分散
     */

    let index =
      workerId;


    const PROGRESS_INTERVAL =
      5000;


    /* =================================================
       SEARCH
    ================================================= */

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


      /* MATCH */

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


      /* PROGRESS */

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


      /*
       * 次のWorker担当位置
       */

      index +=
        workerCount;

    }


    /* =================================================
       DONE
    ================================================= */

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
