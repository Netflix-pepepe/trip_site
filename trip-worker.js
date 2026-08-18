"use strict";

let crypt = null;
let running = false;


/* =========================================
   初期化
========================================= */

try {

    importScripts("./unix-crypt-td.min.js");

    if (typeof self.unixCryptTD === "function") {

        crypt = self.unixCryptTD;

    } else if (typeof self.z === "function") {

        crypt = self.z;

    } else {

        throw new Error(
            "unixCryptTD が見つかりません"
        );
    }

    self.postMessage({
        type: "ready"
    });

} catch (e) {

    self.postMessage({
        type: "error",
        message: e && e.stack
            ? e.stack
            : String(e)
    });
}


/* =========================================
   メッセージ
========================================= */

self.onmessage = function (event) {

    const data = event.data || {};

    if (data.type === "stop") {

        running = false;

        return;
    }


    if (data.type === "test") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message: "crypt is not a function"
            });

            return;
        }

        try {

            const trip =
                makeTrip("aaaaaaaaaa");

            self.postMessage({
                type: "test-ok",
                trip: trip
            });

        } catch (e) {

            self.postMessage({
                type: "error",
                message: e && e.stack
                    ? e.stack
                    : String(e)
            });
        }

        return;
    }


    if (data.type === "search") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message: "unixCryptTD unavailable"
            });

            return;
        }

        running = true;

        search(data);

        return;
    }
};


/* =========================================
   Trip生成
========================================= */

function makeTrip(key) {

    if (typeof crypt !== "function") {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }

    key = String(key);

    /*
     * unixCryptTD は先頭2文字をsaltとして使用
     */
    let salt =
        key.substring(0, 2);

    if (salt.length < 2) {

        salt =
            (salt + "AA")
                .substring(0, 2);
    }

    const result =
        crypt(key, salt);

    if (typeof result !== "string") {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }

    /*
     * unix crypt の先頭2文字はsalt。
     * Trip本体は10文字使用。
     */
    return result.substring(2, 12);
}


/* =========================================
   検索
========================================= */

function search(data) {

    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    const conditions =
        Array.isArray(data.conditions)
            ? data.conditions
            : [];


    const special =
        data.special || "none";


    /*
     * =====================================
     * 複雑化キー用文字セット
     * =====================================
     *
     * 英大文字
     * 英小文字
     * 数字
     * 記号
     *
     * 空白・改行は使用しない。
     */

    const charset =
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";


    let count = 0;


    while (running) {

        /*
         * 複雑化キー生成
         */
        const key =
            randomComplexKey(
                charset,
                length
            );


        let trip;


        try {

            trip =
                makeTrip(key);

        } catch (e) {

            self.postMessage({
                type: "error",
                message: e && e.message
                    ? e.message
                    : String(e)
            });

            running = false;

            return;
        }


        count++;


        /*
         * 条件判定
         */
        if (

            matchesConditions(
                trip,
                conditions
            )

            &&

            matchesSpecial(
                trip,
                special
            )

        ) {

            self.postMessage({
                type: "hit",
                key: key,
                trip: trip
            });
        }


        /*
         * 2048回ごとに進捗送信
         */
        if (
            (count & 2047) === 0
        ) {

            self.postMessage({
                type: "progress",
                count: 2048
            });
        }
    }


    self.postMessage({
        type: "stopped"
    });
}


/* =========================================
   複雑化ランダムキー
========================================= */

function randomComplexKey(
    charset,
    length
) {

    length =
        Number(length);


    if (
        !Number.isFinite(length) ||
        length < 1
    ) {

        length = 10;
    }


    /*
     * 文字カテゴリ
     */

    const upper =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const lower =
        "abcdefghijklmnopqrstuvwxyz";

    const numbers =
        "0123456789";

    const symbols =
        "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";


    /*
     * 結果
     */

    const result = [];


    /*
     * =====================================
     * まず各カテゴリから最低1文字
     * =====================================
     *
     * 10文字キーなら
     *
     * 大文字
     * 小文字
     * 数字
     * 記号
     *
     * を最低1文字ずつ含める。
     */

    const pools = [

        upper,
        lower,
        numbers,
        symbols

    ];


    for (
        let i = 0;

        i < pools.length &&
        result.length < length;

        i++
    ) {

        result.push(

            randomCharExcept(

                pools[i],

                result.length > 0
                    ? result[
                        result.length - 1
                    ]
                    : null
            )
        );
    }


    /*
     * =====================================
     * 残りを生成
     * =====================================
     *
     * 直前と同じ文字は禁止。
     */

    while (
        result.length < length
    ) {

        const previous =
            result[
                result.length - 1
            ];


        result.push(

            randomCharExcept(
                charset,
                previous
            )
        );
    }


    /*
     * =====================================
     * Fisher-Yatesシャッフル
     * =====================================
     *
     * 特定のカテゴリが
     * 特定位置に固定されないようにする。
     */

    shuffleArray(result);


    /*
     * =====================================
     * 同一文字連続チェック
     * =====================================
     *
     * シャッフルによって
     * 同じ文字が隣り合う可能性があるため、
     * 連続がなくなるまでシャッフルする。
     */

    let attempts = 0;


    while (
        hasConsecutiveCharacters(result) &&
        attempts < 100
    ) {

        shuffleArray(result);

        attempts++;
    }


    /*
     * 100回やってもダメなら
     * 最初から作り直す。
     */

    if (
        hasConsecutiveCharacters(result)
    ) {

        return randomComplexKey(
            charset,
            length
        );
    }


    return result.join("");
}


/* =========================================
   指定文字以外からランダム選択
========================================= */

function randomCharExcept(
    chars,
    exclude
) {

    if (
        chars.length <= 1
    ) {

        return chars[0];
    }


    let result;


    do {

        result =
            chars[
                randomInt(chars.length)
            ];

    } while (
        result === exclude
    );


    return result;
}


/* =========================================
   配列シャッフル
========================================= */

function shuffleArray(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            randomInt(i + 1);


        const tmp =
            array[i];

        array[i] =
            array[j];

        array[j] =
            tmp;
    }
}


/* =========================================
   同じ文字の連続チェック
========================================= */

function hasConsecutiveCharacters(
    array
) {

    for (
        let i = 1;
        i < array.length;
        i++
    ) {

        if (
            array[i] ===
            array[i - 1]
        ) {

            return true;
        }
    }


    return false;
}


/* =========================================
   暗号学的乱数
========================================= */

function randomInt(max) {

    if (
        !Number.isInteger(max) ||
        max <= 0
    ) {

        return 0;
    }


    /*
     * Uint32の範囲
     */
    const range =
        4294967296;


    /*
     * modulo biasを避けるため、
     * maxの倍数になる範囲だけ使用。
     */

    const limit =
        Math.floor(
            range / max
        ) * max;


    const buffer =
        new Uint32Array(1);


    let value;


    do {

        crypto.getRandomValues(
            buffer
        );

        value =
            buffer[0];

    } while (
        value >= limit
    );


    return value % max;
}


/* =========================================
   通常条件
========================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition of conditions
    ) {

        if (!condition) {
            continue;
        }


        const text =
            String(
                condition.text || ""
            );


        if (!text) {
            continue;
        }


        /*
         * 正規表現
         */

        if (condition.regex) {

            try {

                const re =
                    new RegExp(text);


                if (
                    !re.test(trip)
                ) {

                    return false;
                }

            } catch (e) {

                return false;
            }


            continue;
        }


        const mode =
            condition.mode ||
            "contains";


        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {

            return false;
        }


        if (
            mode === "starts" &&
            !trip.startsWith(text)
        ) {

            return false;
        }


        if (
            mode === "ends" &&
            !trip.endsWith(text)
        ) {

            return false;
        }


        if (
            mode === "exact" &&
            trip !== text
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   特殊トリップ
========================================= */

function matchesSpecial(
    s,
    type
) {

    switch (type) {

        case "none":
        case "":
            return true;


        case "pure":
            return pureN(s);


        case "quasi":
            return quasiN(s);


        case "two":
            return twoKind(s);


        case "longest":
            return /^[MmW]+$/.test(s);


        case "shortest":
            return /^[li.]+$/.test(s);


        case "yakumo":
            return yakumo(s);


        case "mirror":
            return mirror(s);


        case "palindrome":
            return palindrome(s);


        case "echo":
            return echo(s);


        case "double":
            return doublePair(s);


        case "numbers":
            return /^[0-9]+$/.test(s);


        case "tobiishi":
            return tobiishi(s);


        case "kakutobi":
            return kakutobi(s);


        default:
            return true;
    }
}


/* =========================================
   純n連
   同じ文字8文字以上
========================================= */

function pureN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i] ===
            s[i - 1]
        ) {

            count++;


            if (
                count >= 8
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================
   準n連
   大文字小文字無視で9文字以上
========================================= */

function quasiN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (

            s[i].toLowerCase() ===
            s[i - 1].toLowerCase()

        ) {

            count++;


            if (
                count >= 9
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================
   二構
========================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================
   八雲
   3文字ずつ同じ
========================================= */

function yakumo(s) {

    if (
        s.length < 6
    ) {

        return false;
    }


    /*
     * 10桁なら
     *
     * AAA BBB CCC X
     *
     * のように最後1文字は自由
     */

    const groups =
        Math.floor(
            s.length / 3
        );


    if (
        groups < 2
    ) {

        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (

            s[i] !==
            s[i + 1]

            ||

            s[i] !==
            s[i + 2]

        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   鏡
========================================= */

function mirror(s) {

    const pair = {

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
        "w": "w"
    };


    for (
        let i = 0;
        i < s.length;
        i++
    ) {

        const left =
            s[i];


        const right =
            s[
                s.length -
                1 -
                i
            ];


        if (
            pair[left] !== right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   回文
========================================= */

function palindrome(s) {

    for (
        let i = 0;
        i < Math.floor(
            s.length / 2
        );
        i++
    ) {

        if (

            s[i] !==
            s[
                s.length -
                1 -
                i
            ]

        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   山彦
========================================= */

function echo(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    const half =
        s.length / 2;


    return (

        s.substring(
            0,
            half
        )

        ===

        s.substring(
            half
        )

    );
}


/* =========================================
   双連
========================================= */

function doublePair(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    for (
        let i = 0;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            s[i + 1]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   全数
========================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================
   飛石
   1文字ごとに . または /
========================================= */

function tobiishi(s) {

    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (

            s[i] !== "." &&
            s[i] !== "/"

        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   拡飛
   1文字ごとに同じ区切り文字
========================================= */

function kakutobi(s) {

    if (
        s.length < 2
    ) {

        return false;
    }


    const separator =
        s[1];


    if (

        separator !== "." &&
        separator !== "/"

    ) {

        return false;
    }


    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== separator
        ) {

            return false;
        }
    }


    return true;
}
