import os
import json

def rename_files_from_media():
    """
    根据 'media' 文件中的映射关系重命名当前目录下的文件。

    'media' 文件应为JSON格式，其中键是当前不带扩展名的文件名，
    值是包含扩展名的目标新文件名。

    例如 'media' 文件内容:
    {"622": "ねっしん.mp3", "1805": "～かいしゃ.mp3"}
    """
    media_file_name = 'media'
    renamed_count = 0

    # --- 步骤 1: 读取并解析 media 文件 ---
    try:
        with open(media_file_name, 'r', encoding='utf-8') as f:
            name_mapping = json.load(f)
    except FileNotFoundError:
        print(f"错误：未在当前目录中找到 '{media_file_name}' 文件。")
        return
    except json.JSONDecodeError:
        print(f"错误：'{media_file_name}' 文件内容不是有效的JSON格式。")
        return

    # --- 步骤 2: 获取当前目录下的所有文件名 ---
    files_in_directory = os.listdir('.')
    print("开始扫描并重命名文件...")

    # --- 步骤 3 & 4: 遍历文件并查找映射 ---
    for current_filename in files_in_directory:
        # 确保操作的是文件，而不是文件夹
        if os.path.isfile(current_filename):
            # 分离文件名和扩展名
            file_base_name, file_extension = os.path.splitext(current_filename)

            # 检查文件的基本名称是否存在于映射中
            if file_base_name in name_mapping:
                new_filename = name_mapping[file_base_name]

                # --- 步骤 5: 执行重命名 ---
                try:
                    # 使用 os.rename() 来重命名文件
                    os.rename(current_filename, new_filename)
                    print(f"成功: '{current_filename}' 已重命名为 '{new_filename}'")
                    renamed_count += 1
                except OSError as e:
                    print(f"错误: 重命名 '{current_filename}' 失败: {e}")

    if renamed_count > 0:
        print(f"\n操作完成，总共重命名了 {renamed_count} 个文件。")
    else:
        print("\n操作完成，没有找到与 'media' 文件内容匹配的文件进行重命名。")

if __name__ == '__main__':
    rename_files_from_media()