<template>
  <div class="home">
    <a-upload-dragger
        name="file"
        accept="*.mp4"
        :beforeUpload="beforeUploadHandler"
        :multiple="true"
    >
      <p class="ant-upload-drag-icon">
        <inbox-outlined></inbox-outlined>
      </p>
      <p class="ant-upload-text">Click or drag file to this area to upload</p>
      <p class="ant-upload-hint">
        Support for a single or bulk upload. Strictly prohibit from uploading
        company data or other
        band files
      </p>
    </a-upload-dragger>

    <a-divider>这是分割线</a-divider>

    <ul>
      <li v-for="item in allProgress" :key="item.code">
        <h2>{{ item.blockMark }} - {{ item.fileName }}</h2>
        <h5>{{ item.stateDesc }}</h5>
        <a-progress :percent="item.progress"/>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import {
  emitterAndTaker,
  QueueElementBase,
  uploadHandler,
  UPLOADING_FILE_SUBSCRIBE_DEFINE,
  UploadProgressState,
  UploadProgressStateText
} from "@/utils/uploader";
import {ref} from "vue";
import {equals, isNotEmpty} from "jsmethod-extra";

// 添加订阅
emitterAndTaker.on(UPLOADING_FILE_SUBSCRIBE_DEFINE, function (el: Required<QueueElementBase & {
  stateDesc: string
}>) {
  // 判断是否存在
  const existingElement = allProgress.value.find(item => equals(item.code, el.code));

  switch (el.type) {
    case UploadProgressState.Prepare: {
      if (isNotEmpty(existingElement))
        return;

      allProgress.value.push(el);
      break;
    }
    case UploadProgressState.Waiting: {
      existingElement!.type = UploadProgressState.Waiting;
      existingElement!.stateDesc = UploadProgressStateText[existingElement!.type];
      break;
    }
    case UploadProgressState.Uploading: {
      existingElement!.type = UploadProgressState.Uploading;
      existingElement!.stateDesc = UploadProgressStateText[existingElement!.type];

      const progress = existingElement!.progress;
      existingElement!.progress = progress + el.step;
      break;
    }
  }
})

const allProgress = ref<Array<Required<QueueElementBase & {
  stateDesc: string
}>>>([]);

function beforeUploadHandler(file: File) {
  uploadHandler(file, {code: "1", blockMark: "测试模块"});
  return false;
}
</script>
