module.exports = {
    extends: ['@webank/eslint-config-webank/vue.js'],
    rules: {
        'prettier/prettier': 'off',
        'vue/space-unary-ops': 'off',
        'vue/comma-dangle': 'off',
        'no-debugger': 'error',
        'guard-for-in': 'off',
        semi: ['error', 'never'],
        'import/no-unresolved': [
            2,
            {
                ignore: ['^@/'],
            },
        ],
    },
}
