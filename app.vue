<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex space-x-8 items-center">
            <span class="text-xl font-extrabold text-indigo-600">我的雲端工具箱</span>
            <div class="flex space-x-4">
              <NuxtLink to="/" class="px-3 py-2 rounded-md text-sm font-medium transition-colors" exact-active-class="bg-indigo-100 text-indigo-700" inactive-class="text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                🎵 3GP 轉檔神器
              </NuxtLink>
              
              <!-- 換成新的切割工具入口 -->
              <NuxtLink to="/cutter" class="px-3 py-2 rounded-md text-sm font-medium transition-colors" exact-active-class="bg-indigo-100 text-indigo-700" inactive-class="text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                ✂️ MP3 線上切割
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="py-6">
      <NuxtPage />
    </main>
  </div>
</template>