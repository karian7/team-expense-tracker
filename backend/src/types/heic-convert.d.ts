declare module 'heic-convert' {
  type OutputFormat = 'JPEG' | 'PNG';

  interface ConvertOptions {
    buffer: Buffer;
    format: OutputFormat;
    quality?: number;
  }

  function heicConvert(options: ConvertOptions): Promise<Buffer>;

  export = heicConvert;
}
