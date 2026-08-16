"use strict";

/*
 * 人狼オンライン トリップ検索 Worker
 *
 * 高速化ポイント
 * - Workerを複数起動して並列検索
 * - Workerごとに探索範囲を分割
 * - 進捗postMessageを減らす
 * - ヒット結果をまとめて送信
 * - importScriptsをWorker自身の場所から読み込む
 */

let unixCryptTD = null;
let stopped = false;

// --------------------------------------------------
// ライブラリ読み込み
// --------------------------------------------------

try {
    importScripts(
        new URL("unix-crypt-td.min.js", self.location.href).href
    );

    if (typeof self.unixCryptTD === "function") {
        unixCryptTD = self.unixCryptTD;
    } else if (typeof self.unixCryptTD === "object") {
        unixCryptTD = self.unixCryptTD;
    }
} catch (e) {
    postMessage({
        type: "library-error",
        message:
            "unix-crypt-td.min.js の読み込みに失敗しました: " +
            e.message
    });
}

// --------------------------------------------------
// 状態確認
// --------------------------------------------------

postMessage({
    type: "ready",
    available: typeof unixCryptTD === "function"
});

// --------------------------------------------------
// トリップ生成
// --------------------------------------------------

function saltForTrip(key) {
    let s = (key + "H.").slice(1, 3);

    s = s.replace(/[^.-z]/g, ".");

    s = s.replace(/[:;<=>?@[\\\]^_`]/g, function (c) {
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
    });

    return s;
}

function makeTrip(key) {
    if (typeof unixCryptTD !== "function") {
        throw new Error("unixCryptTD unavailable");
    }

    return "◆" +
        unixCryptTD(
            key,
            saltForTrip(key)
        ).slice(-10);
}

// --------------------------------------------------
// キー生成
// --------------------------------------------------

function keyFromIndex(index, chars, length) {
    const base = chars.length;

    let out = new Array(length);

    for (let i = length - 1; i >= 0; i--) {
        out[i] = chars[index % base];
        index = Math.floor(index / base);
    }

    return out.join("");
}

// --------------------------------------------------
// 通常検索
// --------------------------------------------------

function normalMatch(trip, needles) {
    const t = trip.slice(1);

    for (let i = 0; i < needles.length; i++) {
        const n = needles[i];

        if (!n.text) {
            continue;
        }

        if (n.mode === "prefix") {
            if (!t.startsWith(n.text)) return false;
        }

        else if (n.mode === "suffix") {
            if (!t.endsWith(n.text)) return false;
        }

        else if (n.mode === "exact") {
            if (t !== n.text) return false;
        }

        else {
            if (!t.includes(n.text)) return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 正規表現
// --------------------------------------------------

function regexMatch(trip, expressions) {
    const t = trip.slice(1);

    for (let i = 0; i < expressions.length; i++) {
        try {
            const re = new RegExp(
                expressions[i].text
            );

            if (!re.test(t)) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 純n連
// --------------------------------------------------

function isPureN(trip, n) {
    const t = trip.slice(1);

    let max = 1;
    let count = 1;

    for (let i = 1; i < t.length; i++) {
        if (t[i] === t[i - 1]) {
            count++;

            if (count > max) {
                max = count;
            }
        } else {
            count = 1;
        }
    }

    return max >= n;
}

// --------------------------------------------------
// 準n連
// 大文字小文字を無視
// --------------------------------------------------

function isSemiN(trip, n) {
    const t = trip.slice(1).toLowerCase();

    let max = 1;
    let count = 1;

    for (let i = 1; i < t.length; i++) {
        if (t[i] === t[i - 1]) {
            count++;

            if (count > max) {
                max = count;
            }
        } else {
            count = 1;
        }
    }

    return max >= n;
}

// --------------------------------------------------
// 二構
// --------------------------------------------------

function isNikou(trip) {
    const t = trip.slice(1);

    const set = new Set(t);

    return set.size === 2;
}

// --------------------------------------------------
// 最長
// --------------------------------------------------

function isSaicho(trip) {
    return /^[MmW]+$/.test(trip.slice(1));
}

// --------------------------------------------------
// 最短
// --------------------------------------------------

function isSaitan(trip) {
    return /^[li.]+$/.test(trip.slice(1));
}

// --------------------------------------------------
// 八雲
// 3文字ずつ同じ文字
// 10桁なら最後の1文字は自由
// --------------------------------------------------

function isYakumo(trip) {
    const t = trip.slice(1);

    const usable = t.length - (t.length % 3);

    if (usable < 6) {
        return false;
    }

    for (let i = 0; i < usable; i += 3) {
        if (
            t[i] !== t[i + 1] ||
            t[i] !== t[i + 2]
        ) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 鏡
// --------------------------------------------------

const mirrorMap = {
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

    "i": "i",
    "l": "l",
    "o": "o",
    "p": "q",
    "q": "p",
    "v": "v",
    "w": "w",
    "x": "x"
};

function isKagami(trip) {
    const t = trip.slice(1);

    for (let i = 0; i < t.length; i++) {
        const a = t[i];
        const b = t[t.length - 1 - i];

        if (mirrorMap[a] !== b) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 回文
// --------------------------------------------------

function isKaibun(trip) {
    const t = trip.slice(1);

    for (let i = 0; i < Math.floor(t.length / 2); i++) {
        if (
            t[i] !==
            t[t.length - 1 - i]
        ) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 山彦
// --------------------------------------------------

function isYamabiko(trip) {
    const t = trip.slice(1);

    if (t.length % 2 !== 0) {
        return false;
    }

    const half = t.length / 2;

    return (
        t.slice(0, half) ===
        t.slice(half)
    );
}

// --------------------------------------------------
// 双連
// --------------------------------------------------

function isSoren(trip) {
    const t = trip.slice(1);

    if (t.length % 2 !== 0) {
        return false;
    }

    for (let i = 0; i < t.length; i += 2) {
        if (t[i] !== t[i + 1]) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 全数
// --------------------------------------------------

function isZensu(trip) {
    return /^[0-9]+$/.test(
        trip.slice(1)
    );
}

// --------------------------------------------------
// 飛石
// 1文字ごとに . または /
// --------------------------------------------------

function isTobiishi(trip) {
    const t = trip.slice(1);

    for (let i = 1; i < t.length; i += 2) {
        if (
            t[i] !== "." &&
            t[i] !== "/"
        ) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 拡飛
// 1文字ごとに同じ区切り文字
// --------------------------------------------------

function isKakutobi(trip) {
    const t = trip.slice(1);

    if (t.length < 3) {
        return false;
    }

    const separator = t[1];

    if (
        separator !== "." &&
        separator !== "/"
    ) {
        return false;
    }

    for (let i = 1; i < t.length; i += 2) {
        if (t[i] !== separator) {
            return false;
        }
    }

    return true;
}

// --------------------------------------------------
// 特殊トリップ判定
// --------------------------------------------------

function specialMatch(trip, special) {

    if (!special || special === "none") {
        return true;
    }

    switch (special) {

        case "pure":
            return isPureN(trip, 8);

        case "semi":
            return isSemiN(trip, 9);

        case "nikou":
            return isNikou(trip);

        case "saicho":
            return isSaicho(trip);

        case "saitan":
            return isSaitan(trip);

        case "yakumo":
            return isYakumo(trip);

        case "kagami":
            return isKagami(trip);

        case "kaibun":
            return isKaibun(trip);

        case "yamabiko":
            return isYamabiko(trip);

        case "soren":
            return isSoren(trip);

        case "zensu":
            return isZensu(trip);

        case "tobiishi":
            return isTobiishi(trip);

        case "kakutobi":
            return isKakutobi(trip);

        default:
            return true;
    }
}

// --------------------------------------------------
// メイン検索
// --------------------------------------------------

self.onmessage = function (event) {

    const data = event.data;

    if (data.cmd === "stop") {
        stopped = true;
        return;
    }

    if (data.cmd !== "start") {
        return;
    }

    if (typeof unixCryptTD !== "function") {
        postMessage({
            type: "error",
            message: "unixCryptTD unavailable"
        });
        return;
    }

    stopped = false;

    const chars = data.chars;
    const length = data.length;

    const startIndex = data.startIndex;
    const endIndex = data.endIndex;

    const needles = data.needles || [];
    const regexes = data.regexes || [];

    const special = data.special || "none";

    let attempts = 0;
    let found = 0;

    const startTime = performance.now();

    // 結果をまとめて送信
    const hits = [];

    // ★ ここを大きくするとpostMessage回数が減る
    const REPORT_INTERVAL = 10000;

    for (
        let index = startIndex;
        index < endIndex;
        index++
    ) {

        if (stopped) {
            break;
        }

        const key = keyFromIndex(
            index,
            chars,
            length
        );

        let trip;

        try {
            trip = makeTrip(key);
        } catch (e) {
            postMessage({
                type: "error",
                message: e.message
            });

            return;
        }

        attempts++;

        // 通常条件
        if (
            needles.length &&
            !normalMatch(trip, needles)
        ) {
            continue;
        }

        // 正規表現
        if (
            regexes.length &&
            !regexMatch(trip, regexes)
        ) {
            continue;
        }

        // 特殊トリップ
        if (
            !specialMatch(trip, special)
        ) {
            continue;
        }

        found++;

        hits.push({
            key: key,
            trip: trip
        });

        // 一定数たまったら送信
        if (hits.length >= 20) {
            postMessage({
                type: "hits",
                items: hits.splice(0)
            });
        }

        // 進捗報告
        if (
            attempts % REPORT_INTERVAL === 0
        ) {

            const elapsed =
                (performance.now() - startTime) /
                1000;

            const rate =
                Math.round(
                    attempts /
                    Math.max(elapsed, 0.001)
                );

            postMessage({
                type: "progress",
                attempts: attempts,
                rate: rate,
                found: found
            });
        }
    }

    // 残った結果
    if (hits.length) {
        postMessage({
            type: "hits",
            items: hits
        });
    }

    const elapsed =
        (performance.now() - startTime) /
        1000;

    const rate =
        Math.round(
            attempts /
            Math.max(elapsed, 0.001)
        );

    postMessage({
        type: "done",
        attempts: attempts,
        rate: rate,
        found: found,
        stopped: stopped
    });
};
