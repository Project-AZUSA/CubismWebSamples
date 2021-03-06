/*
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at http://live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import {Live2DCubismFramework as cubismmath} from '../math/cubismmath';
import {Live2DCubismFramework as cubismmodel} from '../model/cubismmodel';
import {Live2DCubismFramework as cubismmotionqueueentry} from './cubismmotionqueueentry';
import {Live2DCubismFramework as csmstring} from '../type/csmstring';
import {Live2DCubismFramework as csmvector} from '../type/csmvector';
import { CSM_ASSERT } from '../utils/cubismdebug';
import csmVector = csmvector.csmVector;
import csmString = csmstring.csmString;
import CubismMotionQueueEntry = cubismmotionqueueentry.CubismMotionQueueEntry;
import CubismModel = cubismmodel.CubismModel;
import CubismMath = cubismmath.CubismMath;

export namespace Live2DCubismFramework
{
    /**
     * モーションの抽象基底クラス
     * 
     * モーションの抽象基底クラス。MotionQueueManagerによってモーションの再生を管理する。
     */
    export abstract class ACubismMotion
    {
        /**
         * インスタンスの破棄
         */
        public static delete(motion: ACubismMotion): void
        {
            motion.release();
            motion = void 0;
            motion = null;
        }

        /**
         * コンストラクタ
         */
        public constructor()
        {
            this._fadeInSeconds = -1.0;
            this._fadeOutSeconds = -1.0;
            this._weight = 1.0;
            this._offsetSeconds = 0.0;  // 再生の開始時刻
            this._firedEventValues = new csmVector<csmString>();
        }

        /**
         * デストラクタ相当の処理
         */
        public release(): void
        {
            this._weight = 0.0;
        }

        /**
         * モデルのパラメータ
         * @param model 対象のモデル
         * @param motionQueueEntry CubismMotionQueueManagerで管理されているモーション
         * @param userTimeSeconds デルタ時間の積算値[秒]
         */
        public updateParameters(model: CubismModel, motionQueueEntry: CubismMotionQueueEntry, userTimeSeconds: number): void
        {
            if(!motionQueueEntry.isAvailable() || motionQueueEntry.isFinished())
            {
                return;
            }

            if(!motionQueueEntry.isStarted())
            {
                motionQueueEntry.setIsStarted(true);
                motionQueueEntry.setStartTime(userTimeSeconds - this._offsetSeconds); // モーションの開始時刻を記録
                motionQueueEntry.setFadeInStartTime(userTimeSeconds); // フェードインの開始時刻

                const duration: number = this.getDuration();

                if(motionQueueEntry.getEndTime() < 0)
                {
                    // 開始していないうちに終了設定している場合がある。
                    motionQueueEntry.setEndTime((duration <= 0) ? -1 : motionQueueEntry.getStartTime() + duration);
                    // duration == -1 の場合はループする
                }
            }

            let fadeWeight: number = this._weight; // 現在の値と掛け合わせる割合

            //---- フェードイン・アウトの処理 ----
            // 単純なサイン関数でイージングする
            const fadeIn: number = this._fadeInSeconds == 0.0
                    ? 1.0
                    : CubismMath.getEasingSine((userTimeSeconds - motionQueueEntry.getFadeInStartTime()) / this._fadeInSeconds);

            const fadeOut: number = (this._fadeOutSeconds == 0.0 || motionQueueEntry.getEndTime() < 0.0)
                    ? 1.0
                    : CubismMath.getEasingSine((motionQueueEntry.getEndTime() - userTimeSeconds) / this._fadeOutSeconds);

            fadeWeight = fadeWeight * fadeIn * fadeOut;

            motionQueueEntry.setState(userTimeSeconds, fadeWeight);

            CSM_ASSERT(0.0 <= fadeWeight && fadeWeight <= 1.0);

            //---- 全てのパラメータIDをループする ----
            this.doUpdateParameters(model, userTimeSeconds, fadeWeight, motionQueueEntry);

            // 後処理
            // 終了時刻を過ぎたら終了フラグを立てる(CubismMotionQueueManager)
            if((motionQueueEntry.getEndTime() > 0) && (motionQueueEntry.getEndTime() < userTimeSeconds))
            {
                motionQueueEntry.setIsFinished(true); // 終了
            }
        }

        /**
         * フェードインの時間を設定する
         * @param fadeInSeconds フェードインにかかる時間[秒]
         */
        public setFadeInTime(fadeInSeconds: number): void
        {
            this._fadeInSeconds = fadeInSeconds;
        }

        /**
         * フェードアウトの時間を設定する
         * @param fadeOutSeconds フェードアウトにかかる時間[秒]
         */
        public setFadeOutTime(fadeOutSeconds: number): void
        {
            this._fadeOutSeconds = fadeOutSeconds;
        }

        /**
         * フェードアウトにかかる時間の取得
         * @return フェードアウトにかかる時間[秒]
         */
        public getFadeOutTime(): number
        {
            return this._fadeOutSeconds;
        }

        /**
         * フェードインにかかる時間の取得
         * @return フェードインにかかる時間[秒]
         */
        public getFadeInTime(): number
        {
            return this._fadeInSeconds;
        }

        /**
         * モーション適用の重みの設定
         * @param weight 重み（0.0 - 1.0）
         */
        public setWeight(weight: number): void
        {
            this._weight = weight;
        }

        /**
         * モーション適用の重みの取得
         * @return 重み（0.0 - 1.0）
         */
        public getWeight(): number
        {
            return this._weight;
        }

        /**
         * モーションの長さの取得
         * @return モーションの長さ[秒]
         * 
         * @note ループの時は「-1」。
         *       ループでない場合は、オーバーライドする。
         *       正の値の時は取得される時間で終了する。
         *       「-1」の時は外部から停止命令がない限り終わらない処理となる。
         */
        public getDuration(): number
        {
            return -1.0;
        }

        /**
         * モーションのループ1回分の長さの取得
         * @return モーションのループ一回分の長さ[秒]
         * 
         * @note ループしない場合は、getDuration()と同じ値を返す
         *       ループ一回分の長さが定義できない場合(プログラム的に動き続けるサブクラスなど)の場合は「-1」を返す
         */
        public getLoopDuration(): number
        {
            return -1.0;
        }

        /**
         * モーション再生の開始時刻の設定
         * @param offsetSeconds モーション再生の開始時刻[秒]
         */
        public setOffsetTime(offsetSeconds: number): void
        {
            this._offsetSeconds = offsetSeconds;
        }

        /**
         * モデルのパラメータ更新
         * 
         * イベント発火のチェック。
         * 入力する時間は呼ばれるモーションタイミングを０とした秒数で行う。
         * 
         * @param beforeCheckTimeSeconds 前回のイベントチェック時間[秒]
         * @param motionTimeSeconds 今回の再生時間[秒]
         */
        public getFiredEvent(beforeCheckTimeSeconds: number, motionTimeSeconds: number): csmVector<csmString>
        {
            return this._firedEventValues;
        }

        /**
         * モーションを更新して、モデルにパラメータ値を反映する
         * @param model 対象のモデル
         * @param userTimeSeconds デルタ時間の積算値[秒]
         * @param weight モーションの重み
         * @param motionQueueEntry CubismMotionQueueManagerで管理されているモーション
         * @return true モデルへパラメータ値の反映あり
         * @return false モデルへのパラメータ値の反映なし（モーションの変化なし）
         */
        public abstract doUpdateParameters(model: CubismModel, userTimeSeconds: number, weight: number, motionQueueEntry: CubismMotionQueueEntry): void;


        public _fadeInSeconds: number; // フェードインにかかる時間[秒]
        public _fadeOutSeconds: number; // フェードアウトにかかる時間[秒]
        public _weight: number; // モーションの重み
        public _offsetSeconds: number; // モーション再生の開始時間[秒]

        public _firedEventValues: csmVector<csmString>;
    }
}