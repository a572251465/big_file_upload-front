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
          <caret-left-outlined @click="pauseHandler(item.uniqueCode)"
                               class="margin"
                               v-if="UploadProgressState.Pause == item.type"/>
          <pause-outlined @click="pauseHandler(item.uniqueCode)" v-else/>
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
import {
  emitterAndTaker,
  QueueElementBase,
  REVERSE_CONTAINER_ACTION,
  uploadHandler,
  UPLOADING_FILE_SUBSCRIBE_DEFINE,
  UploadProgressState,
  UploadProgressStateText
} from "@/utils/uploader";
import {ref} from "vue";
import {equals, isNotEmpty, strFormat} from "jsmethod-extra";
import {
  CaretLeftOutlined,
  CloseOutlined,
  PauseOutlined
} from "@ant-design/icons-vue";

/**
 * 暂停 事件
 *
 * @author lihh
 * @param uniqueCode 表示唯一的 code
 */
function pauseHandler(uniqueCode: string) {
  emitterAndTaker.emit(REVERSE_CONTAINER_ACTION, uniqueCode, UploadProgressState.Pause);
}

// 添加订阅
emitterAndTaker.on(UPLOADING_FILE_SUBSCRIBE_DEFINE, function (el: Required<QueueElementBase & {
  stateDesc: string
}>) {
  // 判断是否存在
  const existingElement = allProgress.value.find(item => equals(item.uniqueCode, el.uniqueCode));
  // 索引
  const index = allProgress.value.findIndex(item => equals(item.uniqueCode, el.uniqueCode));
  // 判断 元素是否存在
  if (existingElement) {
    existingElement.type = el.type;
    existingElement.stateDesc = UploadProgressStateText[existingElement!.type];
  }

  switch (el.type) {
    case UploadProgressState.Prepare: {
      if (isNotEmpty(existingElement))
        return;

      allProgress.value.unshift(el);
      break;
    }
    case UploadProgressState.Uploading: {
      // 从 这里进行进度条累加
      const progress = existingElement!.progress, sum = progress + el.step;
      existingElement!.progress = sum > 100 ? 100 : sum;
      break;
    }
      // 判断是否断点续传
    case UploadProgressState.BreakPointUpload: {
      // 断点续传中 直接设置滚动状态
      existingElement!.progress = el.step;
      break;
    }
      // 判断是否重试中
    case UploadProgressState.Retry: {
      existingElement!.stateDesc = strFormat(existingElement!.stateDesc, el.retryTimes + "");
      break;
    }
      // 表示 这是一个取消状态
    case UploadProgressState.Canceled: {
      if (index !== -1)
        allProgress.value.splice(index, 1);
      break;
    }
    case UploadProgressState.Merge:
    case UploadProgressState.QuickUpload:
    case UploadProgressState.Done: {
      existingElement!.progress = 100;
      break;
    }
  }
})

const allProgress = ref<Array<Required<QueueElementBase & {
  stateDesc: string
}>>>([]);

function callback(res: string) {
  console.log("2 -- " + res);
}

function beforeUploadHandler(file: File) {
  // 表示 不同的 code
  uploadHandler(file, callback).then(res => {
    console.log("1 -- " + res)
  });
  return false;
}

/**
 * 表示 取消的事件动作
 *
 * @author lihh
 * @param uniqueCode 取消的唯一 code
 */
function cancelProgressHandler(uniqueCode: string) {
  emitterAndTaker.emit(REVERSE_CONTAINER_ACTION, uniqueCode, UploadProgressState.Canceled);
}
</script>
