<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`${studentInfo?.userName} - 答题卡详情`"
    width="80%"
    top="5vh"
    @close="handleClose"
  >
    <div v-loading="loading" style="height: 75vh;">
      <el-scrollbar v-if="details">
        <h3>总分: {{ details.answerRecordArchive.score }} / {{ details.answerRecordArchive.standardScore }}</h3>
        <div v-for="item in details.answerRecordArchive.answerRecordDetails" :key="item.topicNumber" class="topic-item">
            <el-descriptions :title="`第 ${item.dispTitle} 题`" border :column="2">
                <el-descriptions-item label="得分/满分">
                    <el-tag :type="item.score === item.standardScore ? 'success' : item.score > 0 ? 'warning' : 'danger'">
                        {{ item.score }} / {{ item.standardScore }}
                    </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="学生答案" v-if="item.answer">{{ item.answer }}</el-descriptions-item>
            </el-descriptions>
            <div class="image-container" v-if="item.topicImages && item.topicImages.length > 0">
                <el-image 
                    v-for="(img, index) in item.topicImages" 
                    :key="index"
                    :src="img"
                    :preview-src-list="item.topicImages"
                    :initial-index="index"
                    fit="contain"
                    style="margin-bottom: 10px; border: 1px solid #ddd;"
                />
            </div>
            <el-divider />
        </div>
      </el-scrollbar>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import axios from 'axios';

const props = defineProps<{
  visible: boolean;
  studentInfo: any;
  markingPaperId: string;
}>();

const emit = defineEmits(['update:visible']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const loading = ref(false);
const details = ref<any>(null);

const fetchDetails = async () => {
    if (!props.studentInfo) return;
    loading.value = true;
    details.value = null;
    try {
        const params = {
            userId: props.studentInfo.userId,
            userCode: props.studentInfo.userCode,
            markingPaperId: props.markingPaperId,
        };
        const { data } = await axios.get('/students/detail', { params });
        details.value = data;
    } catch (error) {
        console.error(error);
    } finally {
        loading.value = false;
    }
}

watch(() => props.visible, (newVal) => {
    if (newVal) {
        fetchDetails();
    }
});

const handleClose = () => {
  dialogVisible.value = false;
};
</script>

<style scoped>
.topic-item { margin-bottom: 20px; }
.image-container { margin-top: 10px; }
</style>
