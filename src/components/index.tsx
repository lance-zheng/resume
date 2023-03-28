import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Button, Affix, Upload, Spin, message, Alert, Modal } from 'antd';
import type { RcFile } from 'antd/lib/upload';
import _ from 'lodash-es';
import qs from 'query-string';
import { getLanguage, getLocale } from '@/locale';
import { useModeSwitcher } from '@/hooks/useModeSwitcher';
import { getDefaultTitleNameMap } from '@/datas/constant';
import { getSearchObj } from '@/helpers/location';
import { customAssign } from '@/helpers/customAssign';
import { copyToClipboard } from '@/helpers/copy-to-board';
import { getDevice } from '@/helpers/detect-device';
import { exportDataToLocal } from '@/helpers/export-to-local';
import { getConfig, saveToLocalStorage } from '@/helpers/store-to-local';
import { fetchResume } from '@/helpers/fetch-resume';
import { Drawer } from './Drawer';
import { Resume } from './Resume';
import type { ResumeConfig, ThemeConfig } from './types';
import './index.less';

export const Page: React.FC = () => {
  const lang = getLanguage();
  const i18n = getLocale();
  const user = getSearchObj().user || 'visiky';

  const [, mode, changeMode] = useModeSwitcher({});

  const originalConfig = useRef<ResumeConfig>();
  const query = getSearchObj();
  const [config, setConfig] = useState<ResumeConfig>();
  const [loading, updateLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<ThemeConfig>({
    color: '#2f5785',
    tagColor: '#8bc34a',
  });

  useEffect(() => {
    const {
      pathname,
      hash: currentHash,
      search: currentSearch,
    } = window.location;
    const hash = currentHash === '#/' ? '' : currentHash;
    const searchObj = qs.parse(currentSearch);
    if (!searchObj.template) {
      const search = qs.stringify({
        template: config?.template || 'template1',
        ...qs.parse(currentSearch),
      });

      window.location.href = `${pathname}?${search}${hash}`;
    }
  }, [config]);

  const updateTemplate = (value: string) => {
    const {
      pathname,
      hash: currentHash,
      search: currentSearch,
    } = window.location;
    const hash = currentHash === '#/' ? '' : currentHash;
    const search = qs.stringify({
      ...qs.parse(currentSearch),
      template: value,
    });

    window.location.href = `${pathname}?${search}${hash}`;
  };

  const changeConfig = (v: Partial<ResumeConfig>) => {
    setConfig(
      _.assign({}, { titleNameMap: getDefaultTitleNameMap({ i18n }) }, v)
    );
  };

  useEffect(() => {
    const user = (query.user || '') as string;
    const branch = (query.branch || 'master') as string;
    const mode = query.mode;

    function store(data) {
      originalConfig.current = data;
      changeConfig(
        _.omit(customAssign({}, data, _.get(data, ['locales', lang])), [
          'locales',
        ])
      );
      updateLoading(false);
    }

    if (!mode) {
      const link = `https://github.com/${user}/${user}/tree/${branch}`;
      fetchResume(lang, branch, user)
        .then(data => store(data))
        .catch(() => {
          Modal.info({
            title: i18n.get('获取简历信息失败'),
            content: (
              <div>
                请检查用户名 {user} 是否正确或者简历信息是否在
                <a href={link} target="_blank">{`${link}/resume.json`}</a>下
              </div>
            ),
            okText: i18n.get('进入在线编辑'),
            onOk: () => {
              changeMode('edit');
            },
          });
        });
    } else {
      getConfig(lang, branch, user).then(data => store(data));
    }
  }, [lang, query.user, query.branch]);

  const onConfigChange = useCallback(
    (v: Partial<ResumeConfig>) => {
      const newC = _.assign({}, config, v);
      changeConfig(newC);
      saveToLocalStorage(query.user as string, newC);
    },
    [config, lang]
  );

  const onThemeChange = useCallback(
    (v: Partial<ThemeConfig>) => {
      setTheme(_.assign({}, theme, v));
    },
    [theme]
  );

  useEffect(() => {
    if (getDevice() === 'mobile') {
      message.info(i18n.get('移动端只提供查看功能，在线制作请前往 PC 端'));
    }
  }, []);

  const [box, setBox] = useState({ width: 0, height: 0, left: 0 });

  useEffect(() => {
    const targetNode = document.querySelector('.resume-content');
    if (!targetNode) return;

    const observer = new MutationObserver(() => {
      setBox(targetNode.getBoundingClientRect());
    });
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // 再加一个定时器，监控下变化
    const interval = setInterval(() => {
      setBox(targetNode.getBoundingClientRect());
    }, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  const importConfig = (file: RcFile) => {
    if (window.FileReader) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          if (reader.result) {
            // @ts-ignore
            const newConfig: ConfigProps = JSON.parse(reader.result);
            onThemeChange(newConfig.theme);
            onConfigChange(_.omit(newConfig, 'theme'));
          }
          message.success(i18n.get('上传配置已应用'));
        } catch (err) {
          message.error(i18n.get('上传文件有误，请重新上传'));
        }
      };
      reader.readAsText(file);
    } else {
      message.error(
        i18n.get('您当前浏览器不支持 FileReader，建议使用谷歌浏览器')
      );
    }
    return false;
  };

  function getConfigJson() {
    let fullConfig = config;
    if (lang !== 'zh_CN') {
      fullConfig = customAssign({}, originalConfig?.current, {
        locales: { [lang]: config },
      });
    }
    return JSON.stringify({ ...fullConfig, theme });
  }

  const copyConfig = () => {
    copyToClipboard(getConfigJson());
  };

  const exportConfig = () => {
    exportDataToLocal(getConfigJson(), `${user}'s resume info`);
  };

  return (
    <React.Fragment>
      <Spin spinning={loading}>
        <div className="page">
          {config && (
            <Resume
              value={config}
              theme={theme}
              template={query.template || 'template1'}
            />
          )}
          {mode === 'edit' && (
            <React.Fragment>
              <Affix offsetTop={0}>
                <Button.Group className="btn-group">
                  <Drawer
                    value={config}
                    onValueChange={onConfigChange}
                    theme={theme}
                    onThemeChange={onThemeChange}
                    template={query.template || 'template1'}
                    onTemplateChange={updateTemplate}
                  />
                  <Button type="primary" onClick={copyConfig}>
                    {i18n.get('复制配置')}
                  </Button>
                  <Button type="primary" onClick={exportConfig}>
                    {i18n.get('保存简历')}
                  </Button>
                  <Upload
                    accept=".json"
                    showUploadList={false}
                    beforeUpload={importConfig}
                  >
                    <Button className="btn-upload">
                      {i18n.get('导入配置')}
                    </Button>
                  </Upload>
                  <Button type="primary" onClick={() => window.print()}>
                    {i18n.get('PDF 下载')}
                  </Button>
                </Button.Group>
              </Affix>
              <div
                className="box-size-info"
                style={{
                  top: `${box.height + 4}px`,
                  left: `${box.width + box.left}px`,
                }}
              >
                ({box.width}, {box.height})
              </div>
            </React.Fragment>
          )}
        </div>
      </Spin>
    </React.Fragment>
  );
};

export default Page;
