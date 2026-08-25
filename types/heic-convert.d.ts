// heic-convert ships no types. Narrowed to the one call shape this repo uses —
// see lib/lead-engine/photo-pipeline.ts.
declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer | ArrayBuffer | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>
  export default convert
}
