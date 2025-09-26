import sqlite3
import json
import re
import os

def process_anki_database(db_path='collection.anki21.db', output_path='output.json'):
    """
    读取 Anki 数据库文件，根据 '\u001f' 分隔符提取 notes 数据，并保存为 JSON 文件。

    :param db_path: Anki 数据库 (.anki21.db) 文件的路径。
    :param output_path: 输出的 JSON 文件路径。
    """
    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"错误：数据库文件 '{db_path}' 不存在。请确保文件路径正确。")
        return

    all_records = []
    connection = None
    
    # 定义字段分隔符
    ANKI_FIELD_SEPARATOR = '\u001f'
    EXPECTED_FIELD_COUNT = 11

    try:
        # 1. 连接到 SQLite 数据库
        connection = sqlite3.connect(db_path)
        cursor = connection.cursor()

        # 2. 从 'notes' 表中仅查询 flds 字段
        cursor.execute("SELECT flds FROM notes")
        rows = cursor.fetchall()

        print(f"从数据库中找到 {len(rows)} 条记录，开始处理...")

        # 3. 遍历每一条记录
        for row in rows:
            flds = row[0]
            try:
                # 4. 使用指定的分隔符分割字段
                parts = flds.split(ANKI_FIELD_SEPARATOR)

                # 5. 检查字段数量是否符合预期
                if len(parts) == EXPECTED_FIELD_COUNT:
                    # 按照指定的11个字段顺序进行提取
                    # 0: 日文
                    # 1: 音调核
                    # 2: 词性
                    # 3: 基本形
                    # 4: 外来语
                    # 5: 中文
                    # 6: 音频
                    # 7: 是否需要从汉字到假名
                    # 8: 是否需要缩小日文
                    # 9: 是否需要缩小假名
                    # 10: 是否需要缩小中文
                    
                    # 提取并清理音频文件名
                    audio_field = parts[6]
                    sound_match = re.search(r'\[sound:(.*?)\]', audio_field)
                    sound_file = sound_match.group(1) if sound_match else ""

                    # 6. 按照指定格式组装数据
                    record = [
                        parts[0],  # 日文
                        parts[1],  # 音调核
                        parts[2],  # 词性
                        parts[3],  # 基本形
                        parts[4],  # 外来语
                        parts[5],  # 中文
                        sound_file, # 清理后的音频文件名
                        parts[7],  # 是否需要从汉字到假名
                        parts[8],  # 是否需要缩小日文
                        parts[9],  # 是否需要缩小假名
                        parts[10]  # 是否需要缩小中文
                    ]
                    all_records.append(record)
                else:
                    # 如果字段格式不符合预期，可以选择跳过这条记录
                    # print(f"警告：跳过字段数不为 {EXPECTED_FIELD_COUNT} 的记录: {flds}")
                    pass

            except Exception as e:
                print(f"处理记录时发生错误，已跳过。记录内容: {flds}\n错误详情: {e}")
                continue

    except sqlite3.Error as e:
        print(f"数据库操作失败: {e}")
    finally:
        # 确保数据库连接被关闭
        if connection:
            connection.close()

    # 7. 将最终结果保存为 JSON 文件
    final_output = {"data": all_records}
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, ensure_ascii=False, indent=4)
        print(f"\n处理完成！成功转换 {len(all_records)} 条记录。")
        print(f"数据已保存到当前目录下的 '{output_path}' 文件中。")
    except IOError as e:
        print(f"写入 JSON 文件时出错: {e}")


# 当直接运行此脚本时，执行以下代码
if __name__ == "__main__":
    process_anki_database()