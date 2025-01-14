// Copyright 2021 99cloud
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { Modal, Button, Tooltip } from 'antd';
import { isArray, isFunction, isBoolean } from 'lodash';
import Confirm from 'components/Confirm';
import PropTypes from 'prop-types';
import Notify from 'components/Notify';
import classnames from 'classnames';
import { firstUpperCase, allSettled } from 'utils';
import styles from './index.less';

function getDefaultMsg(action, data) {
  const { actionName = '', title = '' } = action;
  const name = isArray(data) ? data.map((it) => it.name).join(', ') : data.name;
  const submitErrorMsg = t('Unable to {action} {name}.', {
    action: actionName.toLowerCase() || title,
    name,
  });
  const performErrorMsg = t('You are not allowed to { action } {name}.', {
    action: actionName.toLowerCase() || title,
    name,
  });
  const submitSuccessMsg = firstUpperCase(
    t('{action} {name} successfully.', {
      action: actionName.toLowerCase() || title,
      name,
    })
  );
  const confirmContext = t('Are you sure to { action } {name}?', {
    action: actionName.toLowerCase() || title,
    name,
  });
  return {
    submitErrorMsg,
    submitSuccessMsg,
    confirmContext,
    performErrorMsg,
  };
}

export class ActionButton extends Component {
  static propTypes() {
    return {
      title: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      perform: PropTypes.func.isRequired,
      item: PropTypes.object,
      actionType: PropTypes.string,
      icon: PropTypes.string,
      isAllowed: PropTypes.bool,
      needHide: PropTypes.bool,
      buttonType: PropTypes.string,
      isDanger: PropTypes.bool,
      items: PropTypes.array,
      isBatch: PropTypes.bool,
      path: PropTypes.string,
      onFinishAction: PropTypes.func,
      action: PropTypes.any,
      containerProps: PropTypes.any,
      maxLength: PropTypes.number,
      isFirstAction: PropTypes.bool,
      onClickAction: PropTypes.func,
      visible: PropTypes.bool,
    };
  }

  static defaultProps = {
    item: undefined,
    isAllowed: false,
    confirm: false,
    needHide: true,
    buttonType: 'link',
    isDanger: false,
    isLink: false,
    items: [],
    isBatch: false,
    path: '',
    containerProps: {},
    maxLength: 0,
    isFirstAction: false,
    onClickAction: null,
    visible: false,
  };

  constructor(props) {
    super(props);
    const { id } = props;
    if (!id) {
      throw Error('need id!');
    }
    this.state = {
      visible: false,
      submitLoading: false,
    };
  }

  get routing() {
    return this.props.rootStore.routing;
  }

  onClick = () => {
    const { actionType, onClickAction } = this.props;
    switch (actionType) {
      case 'confirm':
        this.onShowConfirm();
        break;
      case 'link': {
        const { action, item, containerProps } = this.props;
        const { path } = action;
        if (isFunction(path)) {
          const newPath = path(item, containerProps);
          this.routing.push(newPath);
        } else {
          this.routing.push(path);
        }
        break;
      }
      default:
        this.formRef = React.createRef();
        this.showModalAction();
    }
    if (onClickAction) {
      onClickAction();
    }
  };

  handleSubmitLoading = (flag) => {
    this.setState({
      submitLoading: !!flag,
    });
  };

  handleSubmit = (values) => {
    const { item, isBatch, items } = this.props;
    if (!this.onSubmit) return;
    this.handleSubmitLoading(true);
    const data = isBatch ? items : item;
    const result = this.onSubmit(values, data);
    if (result instanceof Promise) {
      result
        .then(
          () => {
            this.onShowSuccess(data);
          },
          (error) => {
            this.onShowError(data, error);
          }
        )
        .finally(() => {
          this.handleSubmitLoading();
        });
    } else {
      this.handleSubmitLoading();
      if (result) {
        this.onShowSuccess(data);
      } else {
        this.onShowError(data, result);
      }
    }
  };

  onOK = () => {
    const { onSubmit, form, item, isBatch, items } = this.props;
    if (!onSubmit) return;
    this.handleSubmitLoading(true);
    form.validateFields([], (err, values) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.log('Values has error: ', err);
        return;
      }
      // eslint-disable-next-line no-console
      console.log('Received values of form: ', values);
      const data = isBatch ? items : item;
      const result = onSubmit(form.getFieldsValue(), data);
      if (result instanceof Promise) {
        result
          .then(
            () => {
              this.onShowSuccess(data);
            },
            (error) => {
              this.onShowError(data, error);
            }
          )
          .finally(() => {
            this.handleSubmitLoading();
          });
      } else {
        this.handleSubmitLoading();
        if (result) {
          this.onShowSuccess(data);
        } else {
          this.onShowError(data, result);
        }
      }
    });
  };

  onShowSuccess = (data, afterSubmit) => {
    const { submitSuccessMsg } = this.props.action;
    const message = submitSuccessMsg
      ? submitSuccessMsg(data)
      : getDefaultMsg(this.props.action, data).submitSuccessMsg;
    Notify.success(message);
    this.onCallback(true, false, afterSubmit);
  };

  // eslint-disable-next-line no-shadow
  onCallback = (success, fail, afterSubmit) => {
    const { onFinishAction, id } = this.props;
    if (onFinishAction) {
      const isDelete = id === 'delete';
      setTimeout(() => {
        onFinishAction(success, fail, isDelete, afterSubmit);
      }, 500);
    }
  };

  // eslint-disable-next-line no-unused-vars
  onShowError = (data, error) => {
    // this.handleModalVisible();
    const { showConfirmErrorBeforeSubmit, confirmErrorMessageBeforeSubmit } =
      this.props.action;
    if (showConfirmErrorBeforeSubmit) {
      Confirm.error({
        content: confirmErrorMessageBeforeSubmit,
      });
      this.onCallback(false, true);
      return;
    }
    const { submitErrorMsg } = this.props.action;
    const { data: responseData } = (error || {}).response || error || {};
    const realError = responseData || error;
    const message = submitErrorMsg
      ? submitErrorMsg(data, realError)
      : getDefaultMsg(this.props.action, data).submitErrorMsg;
    Notify.errorWithDetail(realError, message);
    this.onCallback(false, true);
  };

  onShowConfirm = async () => {
    const {
      perform,
      title,
      confirmContext,
      okText,
      cancelText,
      onSubmit,
      afterSubmit,
    } = this.props.action;
    const { item, items, isBatch, containerProps, onCancelAction } = this.props;
    const data = isBatch ? items : item;
    const content = confirmContext
      ? confirmContext(data)
      : getDefaultMsg(this.props.action, data).confirmContext;
    try {
      perform(data).then(
        () => {
          const modal = Confirm.confirm({
            title,
            content,
            okText,
            cancelText,
            onOk: () => {
              return this.onConfirmOK(
                data,
                onSubmit,
                isBatch,
                containerProps,
                afterSubmit,
                modal
              );
            },
            onCancel: () => {
              onCancelAction && onCancelAction();
            },
          });
        },
        (error) => {
          const message =
            error || getDefaultMsg(this.props.action, data).performErrorMsg;
          Confirm.error({
            content: message,
          });
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      const message =
        error || getDefaultMsg(this.props.action, data).performErrorMsg;
      Confirm.error({
        content: message,
      });
    }
  };

  onSubmitOne = (data, onSubmit, containerProps, afterSubmit) =>
    new Promise((resolve, reject) => {
      const result = onSubmit(data, containerProps);
      if (result instanceof Promise) {
        result.then(
          () => {
            this.onShowSuccess(data, afterSubmit);
            resolve();
          },
          (error) => {
            reject(error);
          }
        );
      } else if (result) {
        this.onShowSuccess(data, afterSubmit);
        resolve();
      } else {
        reject(result);
      }
    }).catch((error) => {
      this.onShowError(data, error);
    });

  onSubmitBatch = (data, onSubmit, containerProps, isBatch, afterSubmit) =>
    new Promise((resolve, reject) => {
      const promises = data.map((it, index) =>
        onSubmit(it, containerProps, isBatch, index, data)
      );
      const results = allSettled(promises);
      results.then((res) => {
        const failedData = res
          .map((it, idx) => {
            if (it.status === 'rejected') {
              return {
                data: data[idx],
                reason: it.reason,
              };
            }
            return null;
          })
          .filter((it) => !!it);
        if (failedData.length === 0) {
          this.onShowSuccess(data, afterSubmit);
          return resolve();
        }
        failedData.forEach((it) => {
          this.onShowError(it.data, it.reason);
        });
        if (failedData.length === data.length) {
          return reject();
        }
        return resolve();
      });
    });

  onConfirmOK = (
    data,
    onSubmit,
    isBatch,
    containerProps,
    afterSubmit,
    modal
  ) => {
    if (isBatch) {
      return this.onSubmitBatch(
        data,
        onSubmit,
        containerProps,
        isBatch,
        afterSubmit
      ).catch(() => {
        modal &&
          modal.update({
            visible: false,
          });
      });
    }
    return this.onSubmitOne(data, onSubmit, containerProps, afterSubmit);
  };

  onClickModalActionOk = () => {
    const { containerProps } = this.props;
    return this.formRef.current.wrappedInstance.onClickSubmit(
      (success, fail) => {
        this.handleSubmitLoading();
        this.onClickModalActionCancel(true);
        this.onCallback(success, fail);
      },
      () => {
        this.handleSubmitLoading(true);
      },
      containerProps
    );
  };

  onClickModalActionCancel = (finish) => {
    const callback = () => {
      if (!isBoolean(finish)) {
        this.formRef.current.wrappedInstance.onClickCancel();
      }
      const { onCancelAction } = this.props;
      this.setState(
        {
          visible: false,
        },
        () => {
          onCancelAction && onCancelAction();
        }
      );
    };
    const {
      action: { beforeCancel },
    } = this.props;
    if (beforeCancel) {
      return beforeCancel(callback);
    }
    callback();
  };

  getModalWidth = (action) => {
    const { modalSize: size, showQuota = false } = action;
    const multi = showQuota ? 1.25 : 1;
    switch (size) {
      case 'small':
        return 520 * multi;
      case 'middle':
        return 720 * multi;
      case 'large':
        return 1200;
      default:
        return 520 * multi;
    }
  };

  showModalAction() {
    this.setState({
      visible: true,
    });
  }

  renderModal() {
    const { visible, submitLoading } = this.state;
    if (!visible) {
      return null;
    }
    const { title, action, item, containerProps, items } = this.props;
    const ActionComponent = action;
    const {
      okText,
      cancelText,
      id,
      className,
      readOnly,
      disableSubmit = false,
    } = action;
    const width = this.getModalWidth(action);
    const modalProps = {
      title,
      visible,
      className: classnames(`modal-${id}`, styles['modal-action'], className),
      width,
      onOk: () => this.onClickModalActionOk(),
      onCancel: this.onClickModalActionCancel,
      okButtonProps: {
        disabled: disableSubmit,
      },
      confirmLoading: submitLoading,
      okText,
      cancelText,
      maskClosable: false,
    };
    if (readOnly) {
      modalProps.cancelButtonProps = {
        style: { display: 'none' },
      };
    }
    return (
      <Modal {...modalProps}>
        <ActionComponent
          item={item}
          items={items}
          ref={this.formRef}
          containerProps={containerProps}
        />
      </Modal>
    );
  }

  render() {
    const {
      isAllowed,
      needHide,
      buttonType,
      buttonClassName,
      name,
      id,
      title,
      isDanger,
      style,
      maxLength,
      isFirstAction,
    } = this.props;
    if (!isAllowed && needHide) {
      return null;
    }
    const buttonText = name || title;
    let showTip = false;
    if (isFirstAction && buttonText && buttonText.length > maxLength) {
      showTip = true;
    }
    const button = (
      <Button
        type={buttonType}
        danger={isDanger}
        onClick={this.onClick}
        key={id}
        disabled={!isAllowed}
        className={buttonClassName}
        style={style}
      >
        {name || title}
      </Button>
    );
    const buttonRender = showTip ? (
      <Tooltip title={buttonText}>{button}</Tooltip>
    ) : (
      button
    );

    return (
      <>
        {buttonRender}
        {this.renderModal()}
      </>
    );
  }
}

export default inject('rootStore')(observer(ActionButton));
