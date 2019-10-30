export const _getContentTypeFromExtension = (extension) => {
  const contentType = {
    zip: 'application/x-zip',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv'
  }
  return contentType[extension] || ''
}
  