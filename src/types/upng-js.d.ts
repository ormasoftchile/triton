declare module 'upng-js' {
  export interface DecodedPng {
    readonly width: number;
    readonly height: number;
    readonly frames: readonly unknown[];
    readonly tabs?: {
      readonly acTL?: {
        readonly num_frames: number;
        readonly num_plays: number;
      };
    };
  }

  const UPNG: {
    encode(imgs: readonly ArrayBuffer[], w: number, h: number, cnum: number, dels?: readonly number[]): ArrayBuffer;
    decode(buffer: ArrayBuffer): DecodedPng;
    toRGBA8(img: DecodedPng): ArrayBuffer[];
  };

  export default UPNG;
}
