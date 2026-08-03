/**
 * Jest stand-in for `require('...tflite')`.
 *
 * Metro returns a numeric asset id for a required binary asset. Jest has no
 * asset pipeline, and must never read the real 141 MB model, so this stub
 * returns a fake id. Providers are tested with an injected loader anyway.
 */
module.exports = 1;
