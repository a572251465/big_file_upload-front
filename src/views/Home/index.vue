<template>
  <div class="home">
    <ul>
      <li v-for="item in allProgress" :key="item.uniqueCode">
        <h3>{{ item.fileName }}</h3>
        <h5>{{ item.stateDesc }}</h5>
        <div class="detail">
          <a-progress :percent="item.progress" class="margin"/>
          <close-outlined @click="cancelProgressHandler(item.uniqueCode)"
                          class="margin"/>
          <caret-left-outlined @click="pauseProgressHandler(item.uniqueCode)"
                               class="margin"
                               v-if="UploadProgressState.Pause == item.type"/>
          <pause-outlined @click="pauseProgressHandler(item.uniqueCode)"
                          v-else/>
        </div>
      </li>
    </ul>

    <a-divider>这是分割线</a-divider>

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
  </div>
</template>

<style lang="less" scoped>
ul, li {
  list-style: none;
}

ul {
  width: 60%;
  margin: 0 auto;
  border: 1px solid #ccc;
  padding: 20px;
  border-radius: 6px;
  min-height: 200px;
  max-height: 300px;
  overflow-x: hidden;
  overflow-y: auto;

  .detail {
    display: flex;

    .margin {
      margin: 0 5px;
    }
  }
}
</style>

<script lang="ts" setup>
import {uploadHandler, UploadProgressState} from "@/utils/uploader";
import {
  CaretLeftOutlined,
  CloseOutlined,
  PauseOutlined
} from "@ant-design/icons-vue";
import {useBigFileUpload} from "@/hooks";


const [allProgress, cancelProgressHandler, pauseProgressHandler] = useBigFileUpload();

uploadHandler.config({persist: true});

async function beforeUploadHandler(file: File) {
  // 表示 不同的 code
  uploadHandler(file)
  return false;
}
</script>
