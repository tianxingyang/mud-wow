declare const contentIdBrand: unique symbol;
declare const contentVersionBrand: unique symbol;

export type ContentId = string & { readonly [contentIdBrand]: true };
export type ContentVersion = string & { readonly [contentVersionBrand]: true };

const CONTENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const MAX_CONTENT_ID_LENGTH = 128;
const MAX_CONTENT_VERSION_LENGTH = 128;

export function isContentId(value: unknown): value is ContentId {
  return (
    typeof value === "string" &&
    value.length <= MAX_CONTENT_ID_LENGTH &&
    CONTENT_ID_PATTERN.test(value)
  );
}

export function isContentVersion(value: unknown): value is ContentVersion {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CONTENT_VERSION_LENGTH &&
    value.trim() === value
  );
}
