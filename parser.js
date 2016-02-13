var reader = new FileReader()
var fileSeek = 0;
var data = {};
var fileData;

document.getElementById('files').addEventListener('change', function() {
  reader.onload = function(e) {
    fileData = e.target.result
    parse()
  }

  // The use of global variables means we can only parse 1 file at a time.
  // TODO: Refactor to be able to parse any number.
  reader.readAsBinaryString(this.files[0]);
}, false);

function parse() {
  // Length of properties section
  properties_length = readInteger()

  // CRC check
  crc = readUnknown()

  data['version_number'] = readInteger() + '.' + readInteger()
  data['version'] = readString()
  data['header'] = readProperties()

  console.log(data)
}

function rawStringToBuffer(str) {
    var idx;
    var len = str.length;
    var arr = new Array(len);

    for (idx=0; idx<len; idx++) {
        arr[idx] = str.charCodeAt(idx) & 0xFF;
    }

    // You may create an ArrayBuffer from a standard array (of values) as follows:
    return new Uint8Array(arr).buffer;
}

function getBytes(length) {
  if (length === undefined) {
    length = 4;
  }

  string = fileData.slice(fileSeek, fileSeek + length)
  console.assert(string.length == length, 'Slice length does not match.')

  fileSeek += length
  return string
}

function readInteger(length) {
  string = getBytes(length)
  buffer_array = rawStringToBuffer(string)

  switch (string.length) {
    case 1:
      return new DataView(buffer_array).getInt8(0, true)
    case 2:
      return new DataView(buffer_array).getInt16(0, true)
    case 4:
    case 8:
      return new DataView(buffer_array).getInt32(0, true)
  }
}

function readFloat(length) {
  string = getBytes(length)
  buffer_array = rawStringToBuffer(string)

  switch (string.length) {
    case 4:
      return new DataView(buffer_array).getFloat32(0, true)
    case 8:
      return new DataView(buffer_array).getFloat64(0, true)
  }
}

function readUnknown(length) {
  return getBytes(length)
}

function readString(length) {
  if (length === undefined) {
    string_length = readInteger()
  } else {
    string_length = length
  }

  string = getBytes(string_length)

  return string.substr(0 , string.length - 1)
}

function readProperties() {
  var results = {}

  while (1) {
    property = readProperty()

    if (property) {
      results[property.name] = property.value
    } else {
      return results
    }
  }
}

function readProperty() {
  var property_name = readString()

  if (property_name === 'None') {
    return
  }

  var type_name = readString()
  var value;

  switch (type_name) {
    case 'IntProperty':
      value_length = readInteger(8)
      value = readInteger(value_length)
      break
    case 'StrProperty':
      unknown = readInteger(8)

      value_length = readInteger()

      if (value_length < 0) {
        value_length = Math.abs(value_length) * 2
      }

      value = readString(value_length)
      break
    case 'ByteProperty':
      unknown = readInteger(8)
      value = {}
      value[readString()] = readString()
      break
    case 'QWordProperty':
      // 64 bit int, 8 bytes.
      value_length = readInteger(8)
      value = readInteger(value_length)
      break
    case 'BoolProperty':
      unknown = readInteger(8)
      value = Boolean(readInteger(1))
      break
    case 'FloatProperty':
      value_length = readInteger(8)
      value = readFloat(value_length)
      break
    case 'NameProperty':
      unknown = readInteger(8)
      value = readString()
      break
    case 'ArrayProperty':
      currentFileSeek = fileSeek

      length_in_file = readInteger(8)
      array_length = readInteger()

      value = []

      for (var i=0; i<array_length; i++) {
        value.push(readProperties())
      }

      console.assert(fileSeek == currentFileSeek + length_in_file + 8)
      break
    default:
      console.error('Unknown type:', type_name.slice(0, 20))
      return
  }

  return {
    'name': property_name,
    'value': value,
  }
}
