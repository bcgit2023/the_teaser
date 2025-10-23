declare module 'jsonwebtoken' {
    export function sign(payload: string | object | Buffer, secretOrPrivateKey: string | Buffer, options?: SignOptions): string;
    export function verify(token: string, secretOrPublicKey: string | Buffer, options?: VerifyOptions): object | string;
    
    export interface SignOptions {
      algorithm?: string;
      expiresIn?: string | number;
      notBefore?: string | number;
      audience?: string | string[];
      issuer?: string;
      jwtid?: string;
      subject?: string;
      noTimestamp?: boolean;
      header?: object;
      keyid?: string;
    }
  
    export interface VerifyOptions {
      algorithms?: string[];
      audience?: string | RegExp | Array<string | RegExp>;
      clockTolerance?: number;
      issuer?: string | string[];
      ignoreExpiration?: boolean;
      ignoreNotBefore?: boolean;
      jwtid?: string;
      subject?: string;
      maxAge?: string | number;
    }
  }