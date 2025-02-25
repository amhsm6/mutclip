// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.36.5
// 	protoc        v6.30.0--rc1
// source: clip.proto

package clip

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
	unsafe "unsafe"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type Message struct {
	state protoimpl.MessageState `protogen:"open.v1"`
	// Types that are valid to be assigned to Msg:
	//
	//	*Message_Text
	//	*Message_Hdr
	//	*Message_Chunk
	//	*Message_Ack
	//	*Message_Err
	Msg           isMessage_Msg `protobuf_oneof:"msg"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Message) Reset() {
	*x = Message{}
	mi := &file_clip_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Message) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Message) ProtoMessage() {}

func (x *Message) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Message.ProtoReflect.Descriptor instead.
func (*Message) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{0}
}

func (x *Message) GetMsg() isMessage_Msg {
	if x != nil {
		return x.Msg
	}
	return nil
}

func (x *Message) GetText() *Text {
	if x != nil {
		if x, ok := x.Msg.(*Message_Text); ok {
			return x.Text
		}
	}
	return nil
}

func (x *Message) GetHdr() *FileHeader {
	if x != nil {
		if x, ok := x.Msg.(*Message_Hdr); ok {
			return x.Hdr
		}
	}
	return nil
}

func (x *Message) GetChunk() *Chunk {
	if x != nil {
		if x, ok := x.Msg.(*Message_Chunk); ok {
			return x.Chunk
		}
	}
	return nil
}

func (x *Message) GetAck() *Ack {
	if x != nil {
		if x, ok := x.Msg.(*Message_Ack); ok {
			return x.Ack
		}
	}
	return nil
}

func (x *Message) GetErr() *Error {
	if x != nil {
		if x, ok := x.Msg.(*Message_Err); ok {
			return x.Err
		}
	}
	return nil
}

type isMessage_Msg interface {
	isMessage_Msg()
}

type Message_Text struct {
	Text *Text `protobuf:"bytes,1,opt,name=text,proto3,oneof"`
}

type Message_Hdr struct {
	Hdr *FileHeader `protobuf:"bytes,2,opt,name=hdr,proto3,oneof"`
}

type Message_Chunk struct {
	Chunk *Chunk `protobuf:"bytes,3,opt,name=chunk,proto3,oneof"`
}

type Message_Ack struct {
	Ack *Ack `protobuf:"bytes,4,opt,name=ack,proto3,oneof"`
}

type Message_Err struct {
	Err *Error `protobuf:"bytes,5,opt,name=err,proto3,oneof"`
}

func (*Message_Text) isMessage_Msg() {}

func (*Message_Hdr) isMessage_Msg() {}

func (*Message_Chunk) isMessage_Msg() {}

func (*Message_Ack) isMessage_Msg() {}

func (*Message_Err) isMessage_Msg() {}

type Text struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Data          string                 `protobuf:"bytes,1,opt,name=data,proto3" json:"data,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Text) Reset() {
	*x = Text{}
	mi := &file_clip_proto_msgTypes[1]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Text) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Text) ProtoMessage() {}

func (x *Text) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[1]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Text.ProtoReflect.Descriptor instead.
func (*Text) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{1}
}

func (x *Text) GetData() string {
	if x != nil {
		return x.Data
	}
	return ""
}

type FileHeader struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Filename      string                 `protobuf:"bytes,1,opt,name=filename,proto3" json:"filename,omitempty"`
	ContentType   string                 `protobuf:"bytes,2,opt,name=contentType,proto3" json:"contentType,omitempty"`
	NumChunks     int32                  `protobuf:"varint,3,opt,name=numChunks,proto3" json:"numChunks,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *FileHeader) Reset() {
	*x = FileHeader{}
	mi := &file_clip_proto_msgTypes[2]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *FileHeader) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*FileHeader) ProtoMessage() {}

func (x *FileHeader) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[2]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use FileHeader.ProtoReflect.Descriptor instead.
func (*FileHeader) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{2}
}

func (x *FileHeader) GetFilename() string {
	if x != nil {
		return x.Filename
	}
	return ""
}

func (x *FileHeader) GetContentType() string {
	if x != nil {
		return x.ContentType
	}
	return ""
}

func (x *FileHeader) GetNumChunks() int32 {
	if x != nil {
		return x.NumChunks
	}
	return 0
}

type Chunk struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Index         int32                  `protobuf:"varint,1,opt,name=index,proto3" json:"index,omitempty"`
	Data          []byte                 `protobuf:"bytes,2,opt,name=data,proto3" json:"data,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Chunk) Reset() {
	*x = Chunk{}
	mi := &file_clip_proto_msgTypes[3]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Chunk) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Chunk) ProtoMessage() {}

func (x *Chunk) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[3]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Chunk.ProtoReflect.Descriptor instead.
func (*Chunk) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{3}
}

func (x *Chunk) GetIndex() int32 {
	if x != nil {
		return x.Index
	}
	return 0
}

func (x *Chunk) GetData() []byte {
	if x != nil {
		return x.Data
	}
	return nil
}

type Ack struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Ack) Reset() {
	*x = Ack{}
	mi := &file_clip_proto_msgTypes[4]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Ack) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Ack) ProtoMessage() {}

func (x *Ack) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[4]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Ack.ProtoReflect.Descriptor instead.
func (*Ack) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{4}
}

type Error struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Desc          string                 `protobuf:"bytes,1,opt,name=desc,proto3" json:"desc,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Error) Reset() {
	*x = Error{}
	mi := &file_clip_proto_msgTypes[5]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Error) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Error) ProtoMessage() {}

func (x *Error) ProtoReflect() protoreflect.Message {
	mi := &file_clip_proto_msgTypes[5]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Error.ProtoReflect.Descriptor instead.
func (*Error) Descriptor() ([]byte, []int) {
	return file_clip_proto_rawDescGZIP(), []int{5}
}

func (x *Error) GetDesc() string {
	if x != nil {
		return x.Desc
	}
	return ""
}

var File_clip_proto protoreflect.FileDescriptor

var file_clip_proto_rawDesc = string([]byte{
	0x0a, 0x0a, 0x63, 0x6c, 0x69, 0x70, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x12, 0x07, 0x6d, 0x75,
	0x74, 0x63, 0x6c, 0x69, 0x70, 0x22, 0xcc, 0x01, 0x0a, 0x07, 0x4d, 0x65, 0x73, 0x73, 0x61, 0x67,
	0x65, 0x12, 0x23, 0x0a, 0x04, 0x74, 0x65, 0x78, 0x74, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0b, 0x32,
	0x0d, 0x2e, 0x6d, 0x75, 0x74, 0x63, 0x6c, 0x69, 0x70, 0x2e, 0x54, 0x65, 0x78, 0x74, 0x48, 0x00,
	0x52, 0x04, 0x74, 0x65, 0x78, 0x74, 0x12, 0x27, 0x0a, 0x03, 0x68, 0x64, 0x72, 0x18, 0x02, 0x20,
	0x01, 0x28, 0x0b, 0x32, 0x13, 0x2e, 0x6d, 0x75, 0x74, 0x63, 0x6c, 0x69, 0x70, 0x2e, 0x46, 0x69,
	0x6c, 0x65, 0x48, 0x65, 0x61, 0x64, 0x65, 0x72, 0x48, 0x00, 0x52, 0x03, 0x68, 0x64, 0x72, 0x12,
	0x26, 0x0a, 0x05, 0x63, 0x68, 0x75, 0x6e, 0x6b, 0x18, 0x03, 0x20, 0x01, 0x28, 0x0b, 0x32, 0x0e,
	0x2e, 0x6d, 0x75, 0x74, 0x63, 0x6c, 0x69, 0x70, 0x2e, 0x43, 0x68, 0x75, 0x6e, 0x6b, 0x48, 0x00,
	0x52, 0x05, 0x63, 0x68, 0x75, 0x6e, 0x6b, 0x12, 0x20, 0x0a, 0x03, 0x61, 0x63, 0x6b, 0x18, 0x04,
	0x20, 0x01, 0x28, 0x0b, 0x32, 0x0c, 0x2e, 0x6d, 0x75, 0x74, 0x63, 0x6c, 0x69, 0x70, 0x2e, 0x41,
	0x63, 0x6b, 0x48, 0x00, 0x52, 0x03, 0x61, 0x63, 0x6b, 0x12, 0x22, 0x0a, 0x03, 0x65, 0x72, 0x72,
	0x18, 0x05, 0x20, 0x01, 0x28, 0x0b, 0x32, 0x0e, 0x2e, 0x6d, 0x75, 0x74, 0x63, 0x6c, 0x69, 0x70,
	0x2e, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x48, 0x00, 0x52, 0x03, 0x65, 0x72, 0x72, 0x42, 0x05, 0x0a,
	0x03, 0x6d, 0x73, 0x67, 0x22, 0x1a, 0x0a, 0x04, 0x54, 0x65, 0x78, 0x74, 0x12, 0x12, 0x0a, 0x04,
	0x64, 0x61, 0x74, 0x61, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x64, 0x61, 0x74, 0x61,
	0x22, 0x68, 0x0a, 0x0a, 0x46, 0x69, 0x6c, 0x65, 0x48, 0x65, 0x61, 0x64, 0x65, 0x72, 0x12, 0x1a,
	0x0a, 0x08, 0x66, 0x69, 0x6c, 0x65, 0x6e, 0x61, 0x6d, 0x65, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09,
	0x52, 0x08, 0x66, 0x69, 0x6c, 0x65, 0x6e, 0x61, 0x6d, 0x65, 0x12, 0x20, 0x0a, 0x0b, 0x63, 0x6f,
	0x6e, 0x74, 0x65, 0x6e, 0x74, 0x54, 0x79, 0x70, 0x65, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52,
	0x0b, 0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x54, 0x79, 0x70, 0x65, 0x12, 0x1c, 0x0a, 0x09,
	0x6e, 0x75, 0x6d, 0x43, 0x68, 0x75, 0x6e, 0x6b, 0x73, 0x18, 0x03, 0x20, 0x01, 0x28, 0x05, 0x52,
	0x09, 0x6e, 0x75, 0x6d, 0x43, 0x68, 0x75, 0x6e, 0x6b, 0x73, 0x22, 0x31, 0x0a, 0x05, 0x43, 0x68,
	0x75, 0x6e, 0x6b, 0x12, 0x14, 0x0a, 0x05, 0x69, 0x6e, 0x64, 0x65, 0x78, 0x18, 0x01, 0x20, 0x01,
	0x28, 0x05, 0x52, 0x05, 0x69, 0x6e, 0x64, 0x65, 0x78, 0x12, 0x12, 0x0a, 0x04, 0x64, 0x61, 0x74,
	0x61, 0x18, 0x02, 0x20, 0x01, 0x28, 0x0c, 0x52, 0x04, 0x64, 0x61, 0x74, 0x61, 0x22, 0x05, 0x0a,
	0x03, 0x41, 0x63, 0x6b, 0x22, 0x1b, 0x0a, 0x05, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x12, 0x12, 0x0a,
	0x04, 0x64, 0x65, 0x73, 0x63, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x64, 0x65, 0x73,
	0x63, 0x42, 0x09, 0x5a, 0x07, 0x70, 0x62, 0x2f, 0x63, 0x6c, 0x69, 0x70, 0x62, 0x06, 0x70, 0x72,
	0x6f, 0x74, 0x6f, 0x33,
})

var (
	file_clip_proto_rawDescOnce sync.Once
	file_clip_proto_rawDescData []byte
)

func file_clip_proto_rawDescGZIP() []byte {
	file_clip_proto_rawDescOnce.Do(func() {
		file_clip_proto_rawDescData = protoimpl.X.CompressGZIP(unsafe.Slice(unsafe.StringData(file_clip_proto_rawDesc), len(file_clip_proto_rawDesc)))
	})
	return file_clip_proto_rawDescData
}

var file_clip_proto_msgTypes = make([]protoimpl.MessageInfo, 6)
var file_clip_proto_goTypes = []any{
	(*Message)(nil),    // 0: mutclip.Message
	(*Text)(nil),       // 1: mutclip.Text
	(*FileHeader)(nil), // 2: mutclip.FileHeader
	(*Chunk)(nil),      // 3: mutclip.Chunk
	(*Ack)(nil),        // 4: mutclip.Ack
	(*Error)(nil),      // 5: mutclip.Error
}
var file_clip_proto_depIdxs = []int32{
	1, // 0: mutclip.Message.text:type_name -> mutclip.Text
	2, // 1: mutclip.Message.hdr:type_name -> mutclip.FileHeader
	3, // 2: mutclip.Message.chunk:type_name -> mutclip.Chunk
	4, // 3: mutclip.Message.ack:type_name -> mutclip.Ack
	5, // 4: mutclip.Message.err:type_name -> mutclip.Error
	5, // [5:5] is the sub-list for method output_type
	5, // [5:5] is the sub-list for method input_type
	5, // [5:5] is the sub-list for extension type_name
	5, // [5:5] is the sub-list for extension extendee
	0, // [0:5] is the sub-list for field type_name
}

func init() { file_clip_proto_init() }
func file_clip_proto_init() {
	if File_clip_proto != nil {
		return
	}
	file_clip_proto_msgTypes[0].OneofWrappers = []any{
		(*Message_Text)(nil),
		(*Message_Hdr)(nil),
		(*Message_Chunk)(nil),
		(*Message_Ack)(nil),
		(*Message_Err)(nil),
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: unsafe.Slice(unsafe.StringData(file_clip_proto_rawDesc), len(file_clip_proto_rawDesc)),
			NumEnums:      0,
			NumMessages:   6,
			NumExtensions: 0,
			NumServices:   0,
		},
		GoTypes:           file_clip_proto_goTypes,
		DependencyIndexes: file_clip_proto_depIdxs,
		MessageInfos:      file_clip_proto_msgTypes,
	}.Build()
	File_clip_proto = out.File
	file_clip_proto_goTypes = nil
	file_clip_proto_depIdxs = nil
}
