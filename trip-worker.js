/*
 * trip-worker.js
 * 人狼オンライン トリップ検索機
 *
 * ・unix-crypt-td.min.jsをWorker内で読み込み
 * ・複数Worker対応
 * ・正規表現対応
 * ・特殊トリップ対応
 * ・最大試行回数なし
 */

let unixCryptTD = null;
let stopped = false;


/* =========================================================
   unixCryptTD 読み込み
========================================================= */

async function loadCrypt() {

  const url =
    new URL(
      "./unix-crypt-td.min.js",
      self.location.href
    ).href;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      "unix-crypt-td.min.js HTTP " +
      response.status
    );
  }

  const source = await response.text();

  if (!source || source.length < 100) {
    throw new Error(
      "unix-crypt-td.min.jsの内容が空です"
    );
  }

  /*
   * unix-crypt-td.min.js は最後に
   *
   * window.unixCryptTD = z
   *
   * としている。
   *
   * Workerにはwindowがないので、
   * new Function()で実行してzを直接取得する。
   */

  const getCrypt = new Function(
    source +
    "\nreturn z;"
  );

  const crypt = getCrypt();

  if (typeof crypt !== "function") {
    throw new Error(
      "unixCryptTD関数を取得できませんでした"
    );
  }

  unixCryptTD = crypt;
}


/* =========================================================
   起動時読み込み
========================================================= */

const cryptReady = loadCrypt()
  .then(() => {

    self.postMessage({
      type: "ready"
    });

  })
  .catch(error => {

    self.postMessage({
      type: "error",
      message:
        "cryptライブラリ読み込み失敗: " +
        error.message
    });

    throw error;
  });


/* =========================================================
   SALT
========================================================= */

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


/* =========================================================
   トリップ生成
========================================================= */

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


/* =========================================================
   INDEX → KEY
========================================================= */

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


/* =========================================================
   鏡用の文字対応
========================================================= */

/*
 * 左右反転したときに対応する文字。
 *
 * 自己対称:
 * . 0 8 A H I M O T U V W X Y
 *
 * 左右反転:
 * b <-> d
 *
 * i <-> l
 *
 * o / p / q などはフォント依存になるため、
 * 一般的な分類で扱いやすい対応を設定。
 */

const MIRROR_MAP = {

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

  "i": "l",
  "l": "i",

  "o": "o",
  "p": "q",
  "q": "p",

  "v": "v",
  "w": "w",
  "x": "x"
};


/* =========================================================
   鏡
========================================================= */

function isKagami(text) {

  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const a = text[i];
    const b =
      text[
        text.length - 1 - i
      ];

    if (
      MIRROR_MAP[a] !== b
    ) {
      return false;
    }
  }

  return true;
}


/* =========================================================
   純n連
========================================================= */

function isJunRen(
  text,
  n
) {

  for (
    let i = 0;
    i <= text.length - n;
    i++
  ) {

    let good = true;

    for (
      let j = 1;
      j < n;
      j++
    ) {

      if (
        text[i] !==
        text[i + j]
      ) {

        good = false;
        break;
      }
    }

    if (good) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   準n連
========================================================= */

function isJunRenLower(
  text,
  n
) {

  const t =
    text.toLowerCase();

  for (
    let i = 0;
    i <= t.length - n;
    i++
  ) {

    let good = true;

    for (
      let j = 1;
      j < n;
      j++
    ) {

      if (
        t[i] !==
        t[i + j]
      ) {

        good = false;
        break;
      }
    }

    if (good) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   二構
========================================================= */

function isNiko(
  text
) {

  return new Set(text).size === 2;
}


/* =========================================================
   最長
========================================================= */

function isSaicho(
  text
) {

  return (
    text.length > 0 &&
    [...new Set(text)]
      .every(c =>
        "MmW".includes(c)
      )
  );
}


/* =========================================================
   最短
========================================================= */

function isSaitan(
  text
) {

  return (
    text.length > 0 &&
    [...new Set(text)]
      .every(c =>
        "li.".includes(c)
      )
  );
}


/* =========================================================
   八雲
========================================================= */

/*
 * 10文字:
 *
 * 1文字 + 3文字 + 3文字 + 3文字
 *
 * 例:
 *
 * 2aaatttwww
 */

function isYakumo(
  text
) {

  if (text.length < 4) {
    return false;
  }

  const remainder =
    text.length % 3;

  /*
   * 残り1文字を先頭に置く。
   * 10桁なら
   *
   * 1 + 3 + 3 + 3
   */

  const offset =
    remainder === 0
      ? 0
      : remainder;

  for (
    let i = offset;
    i + 2 < text.length;
    i += 3
  ) {

    if (
      text[i] !== text[i + 1] ||
      text[i] !== text[i + 2]
    ) {

      return false;
    }
  }

  return true;
}


/* =========================================================
   回文
========================================================= */

function isKaibun(
  text
) {

  for (
    let i = 0;
    i < Math.floor(text.length / 2);
    i++
  ) {

    if (
      text[i] !==
      text[text.length - 1 - i]
    ) {

      return false;
    }
  }

  return true;
}


/* =========================================================
   山彦
========================================================= */

function isYamabiko(
  text
) {

  if (
    text.length % 2 !== 0
  ) {

    return false;
  }

  const half =
    text.length / 2;

  return (
    text.slice(0, half) ===
    text.slice(half)
  );
}


/* =========================================================
   双連
========================================================= */

function isSoren(
  text
) {

  if (
    text.length % 2 !== 0
  ) {

    return false;
  }

  for (
    let i = 0;
    i < text.length;
    i += 2
  ) {

    if (
      text[i] !==
      text[i + 1]
    ) {

      return false;
    }
  }

  return true;
}


/* =========================================================
   全数
========================================================= */

function isZensu(
  text
) {

  return /^[0-9]+$/.test(text);
}


/* =========================================================
   飛石
========================================================= */

/*
 * 1文字ごとに / または .
 *
 * 例:
 *
 * Z.y.O.6.0.
 */

function isTobiishi(
  text
) {

  for (
    let i = 1;
    i < text.length;
    i += 2
  ) {

    if (
      text[i] !== "." &&
      text[i] !== "/"
    ) {

      return false;
    }
  }

  return true;
}


/* =========================================================
   拡飛
========================================================= */

/*
 * 偶数位置が全部同じ文字
 *
 * 例:
 *
 * oUlUEUDUDU
 *
 * U U U U U
 * ↑ ↑ ↑ ↑ ↑
 */

function isKakutobi(
  text
) {

  if (text.length < 2) {
    return false;
  }

  const separator =
    text[1];

  for (
    let i = 1;
    i < text.length;
    i += 2
  ) {

    if (
      text[i] !==
      separator
    ) {

      return false;
    }
  }

  return true;
}


/* =========================================================
   特殊トリップ判定
========================================================= */

function matchesSpecial(
  text,
  type,
  n
) {

  switch (type) {

    case "junren":
      return isJunRen(text, n);

    case "junren2":
      return isJunRenLower(text, n);

    case "niko":
      return isNiko(text);

    case "saicho":
      return isSaicho(text);

    case "saitan":
      return isSaitan(text);

    case "yakumo":
      return isYakumo(text);

    case "kagami":
      return isKagami(text);

    case "kaibun":
      return isKaibun(text);

    case "yamabiko":
      return isYamabiko(text);

    case "soren":
      return isSoren(text);

    case "zensu":
      return isZensu(text);

    case "tobiishi":
      return isTobiishi(text);

    case "kakutobi":
      return isKakutobi(text);

    default:
      return false;
  }
}


/* =========================================================
   条件判定
========================================================= */

function matches(
  trip,
  conditions
) {

  const text =
    trip.replace(/^◆/, "");


  for (
    const condition
    of conditions
  ) {

    /* ---------------------------------------------
       正規表現
    --------------------------------------------- */

    if (
      condition.mode === "regex"
    ) {

      const regex =
        new RegExp(
          condition.text
        );

      if (
        !regex.test(text)
      ) {

        return false;
      }

      continue;
    }


    /* ---------------------------------------------
       特殊トリップ
    --------------------------------------------- */

    if (
      condition.mode ===
      "special"
    ) {

      if (
        !matchesSpecial(
          text,
          condition.type,
          Number(condition.n)
        )
      ) {

        return false;
      }

      continue;
    }


    const needle =
      String(
        condition.text
      )
      .trim()
      .replace(/^◆/, "");


    /* ---------------------------------------------
       前方一致
    --------------------------------------------- */

    if (
      condition.mode === "prefix"
    ) {

      if (
        !text.startsWith(needle)
      ) {

        return false;
      }

      continue;
    }


    /* ---------------------------------------------
       後方一致
    --------------------------------------------- */

    if (
      condition.mode === "suffix"
    ) {

      if (
        !text.endsWith(needle)
      ) {

        return false;
      }

      continue;
    }


    /* ---------------------------------------------
       部分一致
    --------------------------------------------- */

    if (
      !text.includes(needle)
    ) {

      return false;
    }
  }


  return true;
}


/* =========================================================
   Worker開始
========================================================= */

self.onmessage =
  async event => {

    const data =
      event.data;


    /* STOP */

    if (
      data.cmd === "stop"
    ) {

      stopped = true;
      return;
    }


    if (
      data.cmd !== "start"
    ) {

      return;
    }


    try {

      await cryptReady;

    } catch (error) {

      self.postMessage({

        type: "error",

        message:
          error.message

      });

      return;
    }


    stopped = false;


    const chars =
      data.chars;

    const length =
      Number(data.length);

    const workerId =
      Number(data.workerId);

    const workerCount =
      Number(data.workerCount);


    let conditions;

    try {

      conditions =
        data.conditions || [];

      /*
       * 正規表現を事前コンパイルして
       * 入力ミスを早期検出
       */

      for (
        const c of conditions
      ) {

        if (
          c.mode === "regex"
        ) {

          new RegExp(c.text);

        }

      }

    } catch (error) {

      self.postMessage({

        type: "error",

        message:
          "正規表現エラー: " +
          error.message

      });

      return;
    }


    /*
     * 最大試行回数は設定しない。
     *
     * 全キー空間を最後まで検索する。
     *
     * ただし現実的には
     * 「⏹停止」を押して止める。
     */

    const total =
      Math.pow(
        chars.length,
        length
      );


    let attempts = 0;
    let found = 0;


    const started =
      performance.now();


    /*
     * Workerごとに
     *
     * 0,1,2,3...
     *
     * と担当を分ける。
     */

    let index =
      workerId;


    const progressInterval =
      5000;


    while (
      index < total &&
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


      if (
        matches(
          trip,
          conditions
        )
      ) {

        found++;


        self.postMessage({

          type: "hit",

          key,
          trip,

          workerId

        });

      }


      if (
        attempts %
        progressInterval ===
        0
      ) {

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

          type: "progress",

          workerId,

          attempts,

          found,

          rate

        });

      }


      index +=
        workerCount;
    }


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
